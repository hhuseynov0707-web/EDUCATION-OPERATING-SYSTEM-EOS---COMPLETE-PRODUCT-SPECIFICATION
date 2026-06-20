# EOS — ER Diagram

Rendered with Mermaid (GitHub renders this natively).

```mermaid
erDiagram
    USER ||--o| TEACHER : "is"
    USER ||--o| STUDENT : "is"
    USER ||--o| PARENT : "is"
    USER ||--o{ REFRESH_TOKEN : has
    USER ||--o{ AUDIT_LOG : "acts as"

    BRANCH ||--o{ STUDENT : hosts
    BRANCH ||--o{ GROUP : hosts

    PROGRAM ||--o{ SUBJECT : contains
    SUBJECT ||--o{ GROUP : "taught as"
    SUBJECT ||--o{ EXAM : assessed_by
    SUBJECT ||--o{ CURRICULUM_TOPIC : defines

    TEACHER ||--o{ GROUP : teaches
    TEACHER ||--o{ TEACHER_NOTE : writes

    STUDENT ||--o{ GROUP_STUDENT : enrolls
    GROUP   ||--o{ GROUP_STUDENT : has
    GROUP   ||--o{ GROUP_SCHEDULE : "meets on"
    GROUP   ||--o{ LESSON : holds
    GROUP   ||--o{ PAYMENT : bills
    GROUP   ||--o{ CURRICULUM_PROGRESS : tracks

    LESSON  ||--o{ ATTENDANCE : records
    STUDENT ||--o{ ATTENDANCE : marked_in

    STUDENT ||--o{ PAYMENT : owes
    STUDENT ||--o{ EXAM_RESULT : scores
    EXAM    ||--o{ EXAM_RESULT : has
    STUDENT ||--o{ TEACHER_NOTE : "subject of"
    STUDENT ||--o{ RISK_FLAG : flagged_by

    CURRICULUM_TOPIC ||--o{ CURRICULUM_PROGRESS : "status in"

    STUDENT ||--o{ STUDENT_PARENT : linked
    PARENT  ||--o{ STUDENT_PARENT : linked

    USER {
      uuid id PK
      string email UK
      string passwordHash
      enum role
      bool isActive
    }
    STUDENT {
      uuid id PK
      string firstName
      string lastName
      enum status
      date enrollmentDate
      uuid branchId FK
    }
    GROUP {
      uuid id PK
      string name
      uuid subjectId FK
      uuid teacherId FK
      decimal monthlyFee
      enum status
    }
    ATTENDANCE {
      uuid id PK
      uuid lessonId FK
      uuid studentId FK
      enum status
    }
    PAYMENT {
      uuid id PK
      uuid studentId FK
      int periodYear
      int periodMonth
      decimal amountDue
      decimal amountPaid
      enum status
      date dueDate
    }
    RISK_FLAG {
      uuid id PK
      uuid studentId FK
      enum level
      int score
      json reasons
      bool isCurrent
    }
    AUDIT_LOG {
      uuid id PK
      uuid actorUserId FK
      enum action
      string entity
      json oldValue
      json newValue
    }
```

> The full attribute list for every table lives in
> `backend/prisma/schema.prisma`. The diagram above shows cardinalities and the
> key attributes that drive the product's questions.
