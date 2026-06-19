import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string;
  profileId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'change_me_access_secret',
    });
  }

  /** Runs on every authenticated request; result is attached as req.user. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('User no longer active');

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role as AuthUser['role'],
      profileId: payload.profileId ?? null,
    };
  }
}
