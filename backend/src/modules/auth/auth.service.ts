import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';

interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // ── Public flows ──────────────────────────────────────────────────────

  async login(email: string, password: string, meta: SessionMeta): Promise<TokenPair & { user: PublicUser }> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: { actorUserId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ip: meta.ip, userAgent: meta.userAgent },
    });

    const tokens = await this.issueTokens(user, meta);
    return { ...tokens, user: await this.toPublicUser(user) };
  }

  async refresh(refreshToken: string, meta: SessionMeta): Promise<TokenPair> {
    const payload = await this.verifyRefresh(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('User no longer active');

    // Rotate: revoke the old token, issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await argon2.verify(user.passwordHash, current);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(next) },
    });
    // Invalidate all sessions on password change.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.toPublicUser(user);
  }

  static hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private async issueTokens(user: User, meta: SessionMeta): Promise<TokenPair> {
    const profileId = await this.resolveProfileId(user);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      profileId,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? 'change_me_access_secret',
      expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    });

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? 'change_me_refresh_secret',
        expiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return { accessToken, refreshToken };
  }

  private async verifyRefresh(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'change_me_refresh_secret',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async resolveProfileId(user: User): Promise<string | null> {
    if (user.role === Role.TEACHER) {
      const t = await this.prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
      return t?.id ?? null;
    }
    if (user.role === Role.STUDENT) {
      const s = await this.prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
      return s?.id ?? null;
    }
    if (user.role === Role.PARENT) {
      const p = await this.prisma.parent.findUnique({ where: { userId: user.id }, select: { id: true } });
      return p?.id ?? null;
    }
    return null;
  }

  private async toPublicUser(user: User): Promise<PublicUser> {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      profileId: await this.resolveProfileId(user),
    };
  }
}

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  profileId: string | null;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
