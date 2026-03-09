/**
 * Compare-only stress samples.
 *
 * These are intentionally heavier and more complex than the regular gallery
 * and are used ONLY by compare-index.ts.
 */

export interface CompareSample {
  title: string
  description: string
  source: string
  category?: string
  options?: { bg?: string; fg?: string; line?: string; accent?: string; muted?: string; surface?: string; border?: string; font?: string; padding?: number; transparent?: boolean; interactive?: boolean }
}

export const compareExtraSamples: CompareSample[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // FLOWCHART STRESS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Stress: Flowchart — Platform Event Mesh',
    category: 'Compare Stress · Flowchart',
    description: 'Dense event mesh with nested subgraphs, fan-in/fan-out, retries, and error loops.',
    source: `graph TD
  subgraph clients [Clients]
    direction LR
    Web[Web App]
    Mobile[Mobile App]
    Admin[Admin Console]
  end

  subgraph edge [Edge]
    direction LR
    API[API Gateway]
    WAF[WAF]
    Auth[Auth Service]
  end

  subgraph core [Core Services]
    direction LR
    User[User Service]
    Order[Order Service]
    Billing[Billing Service]
    Notify[Notification Service]
    Search[Search Indexer]
  end

  subgraph data [Data Layer]
    direction LR
    UserDB[(User DB)]
    OrderDB[(Order DB)]
    BillDB[(Billing DB)]
    Queue[(Event Bus)]
    Cache[(Redis Cache)]
  end

  Web --> WAF --> API
  Mobile --> WAF
  Admin --> WAF
  API --> Auth
  API --> User
  API --> Order
  API --> Billing

  User --> UserDB
  Order --> OrderDB
  Billing --> BillDB

  User -->|publish profile-updated| Queue
  Order -->|publish order-created| Queue
  Billing -->|publish payment-settled| Queue
  Queue --> Notify
  Queue --> Search
  Queue --> Billing

  User <--> Cache
  Order <--> Cache
  Billing <--> Cache

  Notify -.->|delivery failed| Queue
  Billing -.->|charge retry| Billing
  Order -.->|requeue on timeout| Queue`,
  },
  {
    title: 'Stress: Flowchart — Multi-Region Failover',
    category: 'Compare Stress · Flowchart',
    description: 'Cross-region failover with health checks, rollback paths, and bidirectional replication.',
    source: `graph LR
  subgraph global [Global Edge]
    DNS[Geo DNS]
    CDN[CDN]
    LB[Global Load Balancer]
  end

  subgraph east [Region US-East]
    direction TB
    EApp[App Cluster East]
    EDB[(Primary DB)]
    ECache[(Redis East)]
    EWorker[Workers East]
  end

  subgraph west [Region EU-West]
    direction TB
    WApp[App Cluster West]
    WDB[(Replica DB)]
    WCache[(Redis West)]
    WWorker[Workers West]
  end

  DNS --> CDN --> LB
  LB --> EApp
  LB --> WApp

  EApp --> EDB
  EApp <--> ECache
  EApp --> EWorker

  WApp --> WDB
  WApp <--> WCache
  WApp --> WWorker

  EDB <--> WDB
  EWorker -->|replicate jobs| WWorker
  WWorker -->|replicate jobs| EWorker

  EApp -. health fail .-> LB
  WApp -. health fail .-> LB
  LB -. reroute .-> EApp
  LB -. reroute .-> WApp

  EApp -. rollback .-> EApp
  WApp -. rollback .-> WApp`,
  },
  {
    title: 'Stress: Flowchart — Nested Subgraph Routing Maze',
    category: 'Compare Stress · Flowchart',
    description: 'Heavy cross-subgraph routing with nested groups and local direction overrides.',
    source: `graph TD
  subgraph ingestion [Ingestion]
    direction LR
    A[Capture]
    B[Normalize]
    C[Deduplicate]
    A --> B --> C
  end

  subgraph processing [Processing]
    direction TB
    subgraph rules [Rules Engine]
      direction LR
      D1[Rule Loader] --> D2[Matcher] --> D3[Action Planner]
    end
    subgraph ml [ML Pipeline]
      direction LR
      E1[Feature Builder] --> E2[Model Inference] --> E3[Confidence Scorer]
    end
  end

  subgraph outputs [Outputs]
    direction LR
    F1[Audit Log]
    F2[Alerts]
    F3[Data Lake]
    F4[Dashboard]
  end

  C --> D2
  C --> E1
  D3 --> F2
  D3 --> F1
  E3 --> F2
  E3 --> F3
  F3 --> F4

  D2 -. missing rule .-> D1
  E2 -. model drift .-> E1
  F2 -. feedback .-> D2
  F4 -. analyst correction .-> E1`,
  },
  {
    title: 'Stress: Flowchart — Approval DAG with Long Labels',
    category: 'Compare Stress · Flowchart',
    description: 'Decision-heavy DAG with long edge labels intended to stress label placement and routing.',
    source: `flowchart TD
  R[Request Received] --> V{Is request complete with all mandatory legal and financial metadata?}
  V -- Yes, all mandatory fields are present and valid --> S[Security Review]
  V -- No, missing or malformed required evidence package --> C[Request Clarification]
  C --> R

  S --> P{Is risk profile within acceptable policy boundaries for automated approval?}
  P -- Yes, low risk and no policy exceptions --> A[Auto Approve]
  P -- No, elevated risk or policy exceptions detected --> M[Manual Review Board]

  M --> L{Did board request additional compliance evidence from requester?}
  L -- Yes, additional compliance evidence required before final decision --> C
  L -- No, board has enough context for decision --> D{Final board decision}

  D -- Approved with compensating controls and documented exception --> A
  D -- Rejected due to unresolved regulatory constraints --> X[Reject]

  A --> N[Notify Stakeholders]
  X --> N
  N --> T[Archive Decision Trail]`,
  },
  {
    title: 'Stress: Flowchart — Large Shape Matrix and Crosslinks',
    category: 'Compare Stress · Flowchart',
    description: 'Many node shapes with mixed connector styles, crosslinks, and cycles.',
    source: `graph LR
  A[Rect] --> B(Rounded) --> C{Decision}
  C --> D([Stadium]) --> E((Circle))
  E --> F[[Subroutine]] --> G(((Double Circle)))
  G --> H{{Hexagon}} --> I[(Database)]
  I --> J>Flag] --> K[/Trapezoid\\]
  K --> L[\\Inverse Trap/]

  A -. optional .-> D
  B == urgent ==> H
  C <-->|sync| F
  E -.- telemetry .-> I
  J --- K
  L -->|loop-back| C
  H -->|fanout| D
  H -->|fanout| E
  H -->|fanout| F
  linkStyle default stroke:#6b7280
  linkStyle 2 stroke:#ef4444,stroke-width:2px
  linkStyle 4 stroke:#0ea5e9,stroke-width:2px
  linkStyle 8 stroke:#22c55e,stroke-width:2px`,
  },
  {
    title: 'Stress: Flowchart — Orchestrator with Self-Loops',
    category: 'Compare Stress · Flowchart',
    description: 'Multiple self-loops and retry paths on orchestration states.',
    source: `graph TD
  Q[Queue Intake] --> O[Orchestrator]
  O --> P[Prepare Job]
  P --> X[Execute]
  X --> Y{Result}
  Y -->|success| D[Done]
  Y -->|partial| R[Retry Planner]
  Y -->|failure| F[Failure Handler]

  O -->|heartbeat| O
  O -->|rebalance| O
  X -->|poll status| X
  X -->|stream logs| X
  R -->|requeue| Q
  F -->|manual retry| Q
  F -->|auto retry| O
  D --> Q`,
  },
  {
    title: 'Stress: Flowchart — Bidirectional Integration Graph',
    category: 'Compare Stress · Flowchart',
    description: 'Dense bidirectional integration topology with shared hubs.',
    source: `graph TD
  Hub[(Integration Hub)]
  A[CRM]
  B[ERP]
  C[Warehouse]
  D[Payment]
  E[Fraud]
  F[Support]
  G[Marketing]
  H[Analytics]

  A <--> Hub
  B <--> Hub
  C <--> Hub
  D <--> Hub
  E <--> Hub
  F <--> Hub
  G <--> Hub
  H <--> Hub

  A -. enrichment .-> H
  B -. settlement .-> D
  D -. chargeback .-> E
  F -. ticket update .-> A
  G -. campaign conversion .-> H
  C -. stock signal .-> B
  E -. risk score .-> D`,
  },
  {
    title: 'Stress: Flowchart — Deeply Nested Programs',
    category: 'Compare Stress · Flowchart',
    description: 'Three-level nested subgraphs with cross-level connectors.',
    source: `graph TD
  subgraph org [Program]
    subgraph track1 [Track A]
      direction LR
      A1[Design] --> A2[Build] --> A3[Test]
    end
    subgraph track2 [Track B]
      direction LR
      B1[Spec] --> B2[Implement] --> B3[Verify]
    end
    subgraph track3 [Track C]
      direction LR
      C1[Discover] --> C2[Prototype] --> C3[Ship]
    end
  end

  A2 --> B2
  B2 --> C2
  C2 --> A3
  A1 -. dependency .-> C1
  B3 -. findings .-> A2
  C3 --> B1`,
  },
  {
    title: 'Stress: Flowchart — Dense Fan-In Fan-Out',
    category: 'Compare Stress · Flowchart',
    description: 'Many-to-one and one-to-many lanes to stress edge bundling and clipping.',
    source: `graph LR
  I1[Input 1] & I2[Input 2] & I3[Input 3] & I4[Input 4] --> M[Merger]
  M --> O1[Output 1] & O2[Output 2] & O3[Output 3] & O4[Output 4]
  O1 --> S[Sink]
  O2 --> S
  O3 --> S
  O4 --> S
  I1 -. diagnostic .-> O3
  I4 -. diagnostic .-> O1
  M == critical ==> S`,
  },
  {
    title: 'Stress: Flowchart — Incident Response Runbook',
    category: 'Compare Stress · Flowchart',
    description: 'Realistic incident runbook with escalation loops and parallel responders.',
    source: `graph TD
  A[Alert Triggered] --> B{Severity}
  B -->|SEV1| C[Incident Commander]
  B -->|SEV2| D[On-call Engineer]
  B -->|SEV3| E[Ticket Queue]

  C --> F[Open War Room]
  D --> G[Initial Diagnosis]
  F --> G
  G --> H{Customer Impact?}
  H -->|Yes| I[Status Page Update]
  H -->|No| J[Internal Update]

  G --> K[Mitigation]
  K --> L{Stable?}
  L -->|No| M[Escalate Specialists]
  M --> K
  L -->|Yes| N[Root Cause Analysis]

  N --> O[Action Items]
  O --> P[Postmortem]
  P --> Q[Close Incident]
  I --> Q
  J --> Q
  E -. noisy alert suppression .-> A`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // OTHER COMPLEX TYPES
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Stress: State — Session Lifecycle with Composite States',
    category: 'Compare Stress · State',
    description: 'Composite states, retries, and multiple loops around active processing.',
    source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Intake : request
  Intake --> Validation : parse
  Validation --> Processing : valid
  Validation --> Intake : invalid

  state Processing {
    [*] --> Prepare
    Prepare --> Execute
    Execute --> Verify
    Verify --> Execute : retry step
    Verify --> Finalize : pass
    Finalize --> [*]
  }

  Processing --> Idle : complete
  Processing --> Failed : hard fail
  Failed --> Intake : retry whole flow
  Failed --> [*] : abort`,
  },
  {
    title: 'Stress: Sequence — Distributed Checkout Orchestration',
    category: 'Compare Stress · Sequence',
    description: 'Nested alt/par/loop blocks across many participants.',
    source: `sequenceDiagram
  actor U as User
  participant FE as Frontend
  participant API as API Gateway
  participant AUTH as Auth
  participant INV as Inventory
  participant PAY as Payments
  participant ORD as Orders
  participant NTF as Notifications

  U->>FE: Checkout
  FE->>API: POST /checkout
  API->>AUTH: Validate token
  AUTH-->>API: OK

  par Reserve stock
    API->>INV: reserve(items)
    INV-->>API: reserved
  and Authorize payment
    API->>PAY: authorize(card)
    alt soft-decline
      PAY-->>API: retryable error
      loop up to 2 retries
        API->>PAY: authorize(card)
        PAY-->>API: pending
      end
    else approved
      PAY-->>API: approved
    end
  end

  alt all good
    API->>ORD: create order
    ORD-->>API: orderId
    API->>NTF: send confirmation
    NTF-->>API: queued
    API-->>FE: 200 + orderId
    FE-->>U: Success
  else failed
    API->>INV: release(items)
    API-->>FE: 409/402 error
    FE-->>U: Failure
  end`,
  },
  {
    title: 'Stress: Class — Rich Domain Model',
    category: 'Compare Stress · Class',
    description: 'Larger class graph with multiple relationship types and interfaces.',
    source: `classDiagram
  class AggregateRoot {
    <<abstract>>
    +String id
    +version int
    +apply(event) void
  }
  class Order {
    +addItem(item) void
    +submit() void
    +cancel() void
  }
  class LineItem {
    +sku String
    +qty int
    +price float
  }
  class Payment {
    +authorize() bool
    +capture() bool
  }
  class Shipment {
    +carrier String
    +tracking String
  }
  class DomainEvent {
    <<interface>>
    +occurredAt date
  }
  class OrderSubmitted
  class OrderCancelled
  class EventBus {
    +publish(evt) void
  }

  AggregateRoot <|-- Order
  Order *-- LineItem
  Order o-- Payment
  Order o-- Shipment
  DomainEvent <|.. OrderSubmitted
  DomainEvent <|.. OrderCancelled
  Order ..> EventBus : emits
  Order --> Payment : authorizes
  Order --> Shipment : creates`,
  },
  {
    title: 'Stress: ER — Marketplace Schema',
    category: 'Compare Stress · ER',
    description: 'Dense marketplace ER graph with identifying and non-identifying relationships.',
    source: `erDiagram
  USER {
    int id PK
    string email UK
    string role
  }
  STORE {
    int id PK
    int owner_id FK
    string name
  }
  PRODUCT {
    int id PK
    int store_id FK
    string sku UK
    string title
    float price
  }
  ORDER {
    int id PK
    int buyer_id FK
    string status
    date created_at
  }
  ORDER_ITEM {
    int id PK
    int order_id FK
    int product_id FK
    int qty
    float unit_price
  }
  PAYMENT {
    int id PK
    int order_id FK
    string provider
    string state
  }
  SHIPMENT {
    int id PK
    int order_id FK
    string carrier
    string tracking
  }
  REVIEW {
    int id PK
    int user_id FK
    int product_id FK
    int rating
  }

  USER ||--o{ STORE : owns
  STORE ||--o{ PRODUCT : lists
  USER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : appears-in
  ORDER ||..o{ PAYMENT : billed-by
  ORDER ||..o{ SHIPMENT : ships-via
  USER ||--o{ REVIEW : writes
  PRODUCT ||--o{ REVIEW : receives`,
  },
  {
    title: 'Stress: XY — Multi-Series Operations Dashboard',
    category: 'Compare Stress · XY Chart',
    description: 'Long axis labels and multiple bar/line series in one chart.',
    source: `xychart-beta
    title "Ops Throughput vs Error Rate (Rolling 16 Weeks)"
    x-axis [W01, W02, W03, W04, W05, W06, W07, W08, W09, W10, W11, W12, W13, W14, W15, W16]
    y-axis "Requests / Errors" 0 --> 20000
    bar [8200, 9100, 9800, 10300, 11050, 11700, 12400, 13200, 13900, 14500, 15100, 15800, 16200, 16900, 17400, 18200]
    line [210, 190, 240, 260, 230, 220, 205, 198, 180, 175, 170, 165, 155, 150, 142, 138]
    line [120, 130, 128, 140, 138, 142, 150, 156, 162, 168, 170, 178, 182, 188, 190, 195]`,
    options: { interactive: true },
  },
  {
    title: 'Stress: Gantt — Program Increment Plan',
    category: 'Compare Stress · Gantt',
    description: 'Multiple sections, dependencies, critical tasks, and milestones.',
    source: `gantt
    title Program Increment 7
    dateFormat YYYY-MM-DD
    section Platform
      API hardening            : done, p1, 2026-01-06, 14d
      Auth migration           : active, p2, after p1, 12d
      Multi-region deploy      : crit, p3, after p2, 10d
      Platform readiness       : milestone, after p3, 0d
    section Product
      UX redesign              : done, u1, 2026-01-06, 10d
      Checkout revamp          : active, u2, after u1, 16d
      Recommendation engine    : u3, 2026-01-20, 20d
      Feature freeze           : milestone, 2026-02-18, 0d
    section Quality
      E2E expansion            : q1, 2026-01-16, 14d
      Performance validation   : crit, q2, after q1, 8d
      Security regression      : q3, after q2, 6d
      Go/No-Go                 : milestone, after q3, 0d`,
  },
]
