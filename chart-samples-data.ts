/**
 * Sample definitions for the Phase 1 chart types: Quadrant, Timeline, Gantt.
 *
 * Used by chart-index.ts to generate the visual test gallery.
 */

export interface Sample {
  title: string
  description: string
  source: string
  category?: string
  options?: { bg?: string; fg?: string; line?: string; accent?: string; muted?: string; surface?: string; border?: string; font?: string; padding?: number; transparent?: boolean }
}

export const chartSamples: Sample[] = [

  // ══════════════════════════════════════════════════════════════════════════
  //  QUADRANT CHART
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Quadrant: Priority Matrix',
    category: 'Quadrant',
    description: 'Classic effort vs impact priority matrix with labeled quadrants.',
    source: `quadrantChart
    title Priority Matrix
    x-axis Low Effort --> High Effort
    y-axis Low Impact --> High Impact
    quadrant-1 Do First
    quadrant-2 Schedule
    quadrant-3 Delegate
    quadrant-4 Eliminate
    Feature A: [0.8, 0.9]
    Feature B: [0.3, 0.85]
    Feature C: [0.15, 0.3]
    Feature D: [0.75, 0.2]
    Feature E: [0.5, 0.6]`,
  },

  {
    title: 'Quadrant: Technology Assessment',
    category: 'Quadrant',
    description: 'Evaluating technologies by maturity and business value.',
    source: `quadrantChart
    title Technology Radar
    x-axis Experimental --> Mature
    y-axis Low Value --> High Value
    quadrant-1 Adopt
    quadrant-2 Trial
    quadrant-3 Assess
    quadrant-4 Hold
    React: [0.9, 0.85]
    Svelte: [0.5, 0.7]
    HTMX: [0.35, 0.55]
    Elm: [0.6, 0.3]
    jQuery: [0.95, 0.15]
    Solid: [0.4, 0.65]`,
  },

  {
    title: 'Quadrant: Minimal',
    category: 'Quadrant',
    description: 'Minimal quadrant chart — just axes and points, no quadrant labels.',
    source: `quadrantChart
    x-axis Risk --> Safety
    y-axis Cost --> Revenue
    Product A: [0.2, 0.8]
    Product B: [0.7, 0.6]
    Product C: [0.4, 0.3]`,
  },

  {
    title: 'Quadrant: Team Skills',
    category: 'Quadrant',
    description: 'Mapping team capabilities across two dimensions.',
    source: `quadrantChart
    title Team Skills Assessment
    x-axis Junior --> Senior
    y-axis Specialist --> Generalist
    quadrant-1 Tech Leads
    quadrant-2 Architects
    quadrant-3 Learners
    quadrant-4 Experts
    Alice: [0.8, 0.7]
    Bob: [0.3, 0.2]
    Charlie: [0.6, 0.5]
    Diana: [0.9, 0.3]
    Eve: [0.2, 0.8]
    Frank: [0.5, 0.9]
    Grace: [0.7, 0.4]`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  TIMELINE
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Timeline: Web Evolution',
    category: 'Timeline',
    description: 'Major milestones in web technology history.',
    source: `timeline
    title History of Web Frameworks
    section Early Web
      1995 : JavaScript created
      1999 : AJAX coined
      2004 : Gmail launches
    section Framework Era
      2010 : AngularJS released
      2013 : React open-sourced
      2014 : Vue.js created
    section Modern Web
      2016 : Next.js launched
      2019 : Svelte 3
      2023 : React Server Components`,
  },

  {
    title: 'Timeline: Simple',
    category: 'Timeline',
    description: 'A simple timeline with no sections.',
    source: `timeline
    title Product Launch
    Q1 : Research
       : User interviews
    Q2 : Design
       : Prototyping
    Q3 : Development
       : Beta testing
    Q4 : Launch
       : Marketing push`,
  },

  {
    title: 'Timeline: Company History',
    category: 'Timeline',
    description: 'Multi-section timeline with many events per period.',
    source: `timeline
    title Our Journey
    section Founding
      2018 : Company founded
           : First office
           : Seed funding
      2019 : First product launch
           : 10 employees
    section Growth
      2020 : Series A
           : Remote-first
           : 50 employees
      2021 : International expansion
           : Series B
    section Scale
      2022 : IPO
           : 500 employees
      2023 : Acquired competitor`,
  },

  {
    title: 'Timeline: Single Period',
    category: 'Timeline',
    description: 'Edge case: a timeline with just one period and multiple events.',
    source: `timeline
    title Today
    Morning : Stand-up meeting
            : Code review
            : Feature implementation
            : Lunch break
            : Deploy to staging`,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  GANTT CHART
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Gantt: Project Plan',
    category: 'Gantt',
    description: 'Basic project plan with sections, tasks, and dependencies.',
    source: `gantt
    title Project Alpha
    dateFormat YYYY-MM-DD
    section Design
      Wireframes        : des1, 2024-01-01, 14d
      Visual design     : des2, after des1, 10d
      Design review     : milestone, after des2, 0d
    section Development
      Frontend          : dev1, after des2, 21d
      Backend API       : dev2, after des2, 14d
      Integration       : dev3, after dev1, 7d
    section Launch
      QA Testing        : qa1, after dev3, 10d
      Deployment        : deploy, after qa1, 3d`,
  },

  {
    title: 'Gantt: Sprint Board',
    category: 'Gantt',
    description: 'Two-week sprint with active and completed tasks.',
    source: `gantt
    title Sprint 12
    dateFormat YYYY-MM-DD
    section Stories
      Auth refactor       : done, s1, 2024-03-01, 5d
      Search feature      : active, s2, 2024-03-04, 8d
      Dashboard redesign  : s3, 2024-03-08, 6d
    section Bugs
      Fix login timeout   : done, b1, 2024-03-01, 2d
      Memory leak         : crit, b2, 2024-03-06, 4d
    section Ops
      Deploy v2.1         : milestone, 2024-03-14, 0d`,
  },

  {
    title: 'Gantt: Simple',
    category: 'Gantt',
    description: 'Minimal gantt chart with a single section.',
    source: `gantt
    title Release Plan
    dateFormat YYYY-MM-DD
    section Tasks
      Planning    : 2024-06-01, 7d
      Development : 2024-06-08, 14d
      Testing     : 2024-06-22, 7d
      Release     : milestone, 2024-06-29, 0d`,
  },

  {
    title: 'Gantt: Multi-Section',
    category: 'Gantt',
    description: 'Complex multi-team gantt chart showing parallel workstreams.',
    source: `gantt
    title Q1 Roadmap
    dateFormat YYYY-MM-DD
    section Platform
      Core API v2         : done, p1, 2024-01-02, 21d
      Auth service        : active, p2, 2024-01-15, 14d
      Rate limiting       : p3, after p2, 10d
    section Mobile
      iOS redesign        : done, m1, 2024-01-02, 28d
      Android parity      : active, m2, 2024-01-16, 21d
      Push notifications  : m3, after m2, 7d
    section Data
      Pipeline migration  : done, d1, 2024-01-02, 14d
      Analytics dashboard : d2, after d1, 21d
      ML model training   : d3, after d2, 14d
    section QA
      Integration tests   : qa1, 2024-02-15, 14d
      Performance testing : crit, qa2, after qa1, 7d
      Release sign-off    : milestone, after qa2, 0d`,
  },

  {
    title: 'Gantt: Critical Path',
    category: 'Gantt',
    description: 'Highlighting critical tasks that affect the project deadline.',
    source: `gantt
    title Infrastructure Migration
    dateFormat YYYY-MM-DD
    section Preparation
      Audit current infra    : done, a1, 2024-04-01, 5d
      Capacity planning      : done, a2, after a1, 3d
      Vendor selection       : crit, a3, after a2, 7d
    section Migration
      Database migration     : crit, m1, after a3, 10d
      Service deployment     : crit, m2, after m1, 5d
      DNS cutover            : crit, milestone, after m2, 0d
    section Validation
      Smoke tests            : v1, after m2, 3d
      Load testing           : v2, after v1, 5d
      Monitoring setup       : v3, after v1, 3d`,
  },

]
