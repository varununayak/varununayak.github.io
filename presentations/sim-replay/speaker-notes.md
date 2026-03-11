# Simulation & Replay Infrastructure - Speaker Notes & Q&A Prep

## Slide-by-Slide Notes

### Slide 1: Title
- Welcome everyone, today I'll walk through the simulation and replay infrastructure I built at Dexterity
- This system enabled us to run thousands of simulated pick-and-place cycles nightly, catching regressions before they hit production
- We'll cover the sim architecture, physics backends, plugin system, and CI/CD integration
- **Timing: 1 minute**

### Slide 2: About Me
- Brief introduction - keep it under 30 seconds
- Stanford Robotics background, worked with Dr. Oussama Khatib
- At Dexterity since 2020, promoted to Senior in 2022
- This talk focuses on my simulation infrastructure work - one of my key contributions
- **Timing: 30 seconds**

### Slide 3: Problem Statement
- When I joined, simulation was ad-hoc: engineers ran local sims manually, no CI integration
- Existing sim lacked contact modeling needed for grasp validation and collision checking
- Cost: each robot workcell is $200K+ in hardware; we can't dedicate them to testing
- Speed: a single pick-and-place cycle takes 30-60 seconds on real hardware
- Safety: we need to test what happens when a box falls, conveyor jams, or sensor fails
- The goal was to build infrastructure that makes sim testing as easy as running unit tests
- **Key quote:** "If you can't simulate it, you can't iterate on it fast enough."
- **Timing: 1.5 minutes**

### Slide 4: Architecture Overview
- The sim runs a fixed 100Hz update loop - same rate as our real robot control loop
- Each tick: update entity behaviors, step physics, run plugins, process REST API requests
- Scene+Behaviors define what happens in the sim, Plugins+API extend functionality
- The REST API allows external tools (CI scripts, debugging UIs) to query and control the sim
- Key design decision: plugins run synchronously in the tick loop - keeps things deterministic
- **Key quote:** "The update loop is intentionally simple. Complexity lives in behaviors and plugins."
- **Timing: 2 minutes**

### Slide 5: Scene & Behavior System
- EntityBehavior is the core abstraction: each entity (robot, box, conveyor) has behaviors that drive its simulation
- `initialize()` is async and receives a task_group for spawning background tasks (e.g., robot controller loop)
- `update()` is synchronous and called every tick - all scene mutations must go through the SceneEditor
- SceneEditor pattern: during a tick, behaviors request changes (add/remove/update entities) but changes aren't applied until the tick ends
- `update_entity()` takes a callback fn that receives the current entity and returns the updated entity - composable with other updates
- `get_edits()` collects all pending adds, updates (via PutEntity), and removes into a single list of SceneEdits
- This prevents the classic "modifying a collection while iterating" bug
- **Key quote:** "Deferred mutations keep the simulation deterministic and bug-free."
- **Timing: 1.5 minutes**

### Slide 6: Simulation REST API
- AddObjectsRequest is the primary way to set up a sim scene - called at the start of each sim run
- Uses Pydantic RootModel with discriminated unions: `object_type` field determines which schema to validate against
- SceneObject types map directly to entity behaviors: ConveyorObject creates a conveyor entity with ConveyorBehavior
- AuxiliaryObject supports multiple shape types (cuboid, sphere, cylinder) for static obstacles like tables, walls
- ConveyorObject has rich config: direction vector for belt motion, optional IR beam sensor, box caching modes
- BoxSpawnerObject can generate sequences of boxes at specified positions - used for testing different SKU mixes
- The endpoint parses objects, creates entities via factory functions, applies them as a bulk scene edit, and syncs to Drake if active
- Other endpoints: `GET /status` (polled by CI), `POST /control` (pause/resume/stop), `GET /scene` (entity states), `GET /metrics`
- **Key quote:** "The REST API turned the sim from a script you run into a service you interact with."
- **Timing: 1.5 minutes**

### Slide 7: Plugin Architecture
- The plugin system is the extensibility layer - it's how we add monitoring, logging, and CI integration without modifying the core sim
- Five plugin types in production:
  - **EndConditionPlugin:** defines when a sim run is "done" (e.g., all boxes placed, timeout reached)
  - **WatchdogPlugin:** safety monitoring - kills sim if stuck for too long
  - **WandBPlugin:** logs metrics and artifacts to Weights & Biases
  - **SlackPlugin:** posts results to team channels
  - **StatusPlugin:** REST endpoint polled by CI runners to check sim status
- Adding a new plugin is ~50 lines: implement `setup()`, `on_tick()`, `teardown()`
- **Key quote:** "The plugin protocol made it trivial for other engineers to extend the sim without touching core code."
- **Timing: 1.5 minutes**

### Slide 8: Physics with Drake
- Drake (MIT's robotics toolbox) provides MultibodyPlant: full rigid-body dynamics with contact
- We run Drake as a separate gRPC service - isolates the C++ physics from our Python sim
- Hydroelastic contact model: computes contact patches (not just points), giving realistic grasping behavior
- Dual representation: generic sim for fast, deterministic CI, Drake for physics-accurate nightly runs
- SimState is critical for Drake integration: Drake needs to know which objects it controls (DYNAMIC) vs which the sim controls (KINEMATIC)
- State transitions happen automatically based on robot actions: grasp -> KINEMATIC, release -> DYNAMIC, settle -> STATIC
- This architecture lets us add new physics backends (e.g., MuJoCo) without changing sim code
- **Key quote:** "Generic sim for speed, Drake for truth. Same sim, different physics."
- **Timing: 1.5 minutes**

### Slide 9: Nightly Sim Workflows
- GitLab CI scheduled pipelines trigger nightly at 2 AM - when GPU machines are idle
- `deploy_queued_sim.sh` is a bash wrapper that handles Docker deployment, port allocation, and health checks
- The status endpoint pattern: sim exposes `/status` REST endpoint, CI runner polls every 30 seconds
- This decouples sim lifetime from CI job lifetime - sim can run for hours, CI just polls
- WandB integration: every sim run logs metrics to a project, enabling historical comparison and regression detection
- We generate JUnit XML so GitLab shows pass/fail badges on merge requests
- **Key quote:** "The CI pipeline is the customer of the sim. Everything is designed for automation."
- **Timing: 1.5 minutes**

### Slide 10: ReSim & Distributed Testing
- ReSim is a virtual testing orchestration platform that lets us run hardware, simulation, and replay tests at scale - evaluating performance across thousands of scenarios before deployment
- Nightly regression: 20+ configs x 50 cycles each = 1000+ simulated pick-place cycles per night
- Retry logic is important: Drake physics can occasionally produce non-deterministic results due to floating-point
- Slack reporting: every morning, engineers see a summary of overnight sim results in their channel
- Before this infrastructure: "Did anyone run sim on the new grasp planner?" was a common question with no answer
- **Key quote:** "Distributed sim turned testing from a manual chore into an automated pipeline."
- **Timing: 1.5 minutes**

### Slide 11: Key Takeaways & Q&A
- Three key architectural decisions that made this work:
  - Plugin protocol: other engineers added 4 new plugins without needing my help
  - Dual physics: generic sim for fast iteration, Drake for nightly truth
  - CI/CD first: the sim was designed from day 1 to be run by automation, not humans
- Lessons learned:
  - Determinism is hard but essential - had to fix many sources of non-determinism
  - Start with the CI pipeline, work backwards to the sim
  - WandB was a game-changer for debugging - metric dashboards and run comparisons saved hours
- **Key quote:** "Design your sim for automation first, interactive use second."
- **Timing: 1 minute + Q&A**

---

## Anticipated Q&A

### Architecture & Design

**Q: Why 100Hz for the update loop? Why not run faster or slower?**
> 100Hz matches our real robot control loop rate. Running faster wastes CPU and doesn't improve fidelity since the robot controller itself runs at 100Hz. Running slower introduces aliasing - you miss events that happen between ticks. Matching the real rate also means sim timing maps 1:1 to real-world timing, which matters for debugging.

**Q: Why did you choose a synchronous plugin model instead of async?**
> Determinism. If plugins ran asynchronously, their execution order would be non-deterministic, and the sim would produce different results on different runs. Synchronous execution means every tick produces the exact same state given the same inputs. We did consider async for I/O-heavy plugins (WandB, Slack) but decided to batch their I/O in teardown() instead.

**Q: Why deferred mutations via SceneEditor instead of just locking?**
> Locking would work but introduces deadlock risk and makes the code much harder to reason about. With deferred mutations, every behavior sees the same snapshot of the world during a tick. There's no question about "which behaviors have already run" affecting what another behavior sees. It's also simpler to test - you can assert on the edit list without running the full sim loop.

**Q: Why REST over gRPC for the sim API?**
> Simplicity and debuggability. REST endpoints are trivially testable with curl or a browser. For CI scripts written in bash, calling a REST endpoint is one line (`curl`). gRPC would give us type safety and streaming, but we didn't need those for the sim's external interface. We do use gRPC for Drake integration where performance and typed contracts matter more.

**Q: How do you handle versioning of the sim API?**
> We use Pydantic models for request/response schemas, so we get validation for free. For backwards compatibility, new fields have defaults. We haven't needed formal API versioning because the sim and its consumers (CI scripts, debugging tools) are all in the same monorepo and deploy together.

### Physics & Drake

**Q: Why Drake instead of MuJoCo or Isaac Sim?**
> At the time we started (2021-2022), Drake had the best hydroelastic contact model for grasping scenarios. MuJoCo was newly open-sourced and didn't have the same contact fidelity. Isaac Sim was GPU-only and harder to integrate with our Python codebase. Drake also has excellent Python bindings. The dual-representation architecture means we could swap in MuJoCo later without changing sim code.

**Q: How accurate is the generic sim compared to Drake?**
> For trajectory validation (does the robot hit anything?), generic sim is highly accurate because it uses the same collision geometries and is very deterministic. For grasping (does the box stay in the gripper?), generic sim is essentially a lookup table - it assumes grasps succeed if the grasp planner says they should. Drake actually simulates contact forces, so it catches more grasp failures and collision edge cases. That's why we run Drake nightly - it's the source of truth for physics.

**Q: How do you keep Drake in sync with the sim?**
> Every tick, we send entity poses from the sim to Drake via gRPC. Drake advances its physics by one timestep and returns updated poses for DYNAMIC objects. The SimState enum is the contract: KINEMATIC objects are controlled by the sim (Drake treats them as fixed), DYNAMIC objects are controlled by Drake (sim accepts Drake's poses). State transitions are triggered by robot actions (grasp, release) and are communicated to Drake as model updates.

**Q: Does Drake introduce latency into the sim loop?**
> Yes, about 2-5ms per tick for a typical scene (~20 objects). That's well within our 10ms tick budget. For very complex scenes (50+ objects with many contacts), it can spike to 8-10ms. We handle this by running Drake in a separate process and using async gRPC calls - the sim can overlap other work while waiting for Drake. In the worst case, we drop to ~60Hz which is acceptable for testing.

**Q: How do you handle non-determinism in Drake's physics?**
> Drake is mostly deterministic given the same inputs, but floating-point order-of-operations can vary across machines. We handle this in CI by running each test 3 times and accepting a 2/3 majority pass. For replay scenarios, we snapshot Drake's internal state (not just poses) so we can resume from an exact state. In practice, non-determinism affects <1% of runs.

### CI/CD & Infrastructure

**Q: How long does a full nightly sim suite take?**
> A single sim config takes 15-45 minutes depending on the number of cycles. With 20+ configs running in parallel on ReSim, the full suite completes in about 1-2 hours. Results are available by 4-5 AM, well before engineers start work. We tuned this by adjusting the number of cycles per config - enough to catch regressions, not so many that it takes all night.

**Q: What happens when a nightly sim fails?**
> SlackPlugin posts to #sim-nightly with: which configs failed, links to WandB runs with metrics, and a diff of what changed since the last passing run. The on-call engineer triages in the morning. If it's a known flaky test, they mark it and move on. If it's a real regression, they can look at the WandB metrics to see exactly what went wrong - cycle time spikes, error rate changes, throughput drops.

**Q: How do you handle flaky tests?**
> Three layers: (1) retry logic with exponential backoff catches transient failures, (2) we track flake rates per config in the data platform and flag configs with >5% flake rate for investigation, (3) WatchdogPlugin detects stuck sims (no progress for 60s) and kills them with a TIMEOUT result rather than letting them hang. Most flakiness comes from Drake physics non-determinism or race conditions in the robot controller - both are real bugs worth investigating.

**Q: Why polling via /status instead of webhooks or streaming?**
> Polling is simpler and more resilient. If the CI runner crashes and restarts, it just resumes polling - no state to reconstruct. Webhooks require the CI runner to expose an endpoint, which is harder in our GitLab infrastructure. Streaming (SSE/WebSocket) adds connection management complexity. At 30-second intervals, polling is ~2 HTTP requests per minute - negligible overhead. KISS principle.

**Q: How do you manage the 20+ sim config files?**
> YAML configs with an include/override system. There's a base config per robot type, then variants override specific fields (SKU mix, conveyor speed, number of cycles). Configs are version-controlled in the same repo. The CI pipeline enumerates configs from a directory, so adding a new test is just adding a YAML file - no pipeline changes needed.

### Scale & Performance

**Q: What are the compute requirements?**
> Each sim instance needs 4 CPU cores and 8GB RAM for the Python sim. If running Drake, add 2 cores and 4GB for the Drake gRPC service. GPU is needed for rendering (optional) and some perception-in-the-loop tests. On ReSim, we use c5.2xlarge instances (8 vCPU, 16GB) for non-Drake and g4dn.xlarge for GPU tests. Total nightly compute cost is about $15-20.

**Q: How did you test the sim infrastructure itself?**
> Unit tests for individual components (SceneEditor, plugins, REST endpoints). Integration tests that run a full sim for 100 ticks and assert on final state. Golden file tests that compare sim output against known-good baselines. And dogfooding - we used the sim daily for development, which caught integration issues fast.

**Q: Did you consider using a game engine (Unity/Unreal) instead of building custom?**
> Yes, we evaluated Unity with ROS integration. Two issues: (1) our robot controller is tightly coupled to our Python codebase and ROS-independent, so bridging to Unity added significant latency and complexity; (2) we needed deterministic, headless execution for CI - game engines are optimized for real-time rendering, not batch testing. Building custom let us optimize for our use case: fast, deterministic, CI-first.

### Replay & Debugging

**Q: How does replay work?**
> The sim config (YAML + random seeds + entity initial state) is snapshotted at the start of each run. To replay, you load that snapshot and the sim reproduces the same run. For Drake runs, we also snapshot Drake's model state. Replay is deterministic for generic sim; for Drake, it's deterministic within the same machine but may vary slightly across machines.

**Q: How do engineers debug a failing sim run?**
> Three tools: (1) WandB metrics - plot cycle times, entity counts, error rates over time, (2) local replay - download the session config and run it locally with a visualization, (3) log analysis - structured logs from each tick with entity states. For subtle physics bugs, engineers run locally with Drake visualization (Drake has a built-in 3D viewer).

### Team & Process

**Q: How many people worked on this?**
> I was the primary architect and implementer for the Python-side sim infrastructure. One colleague owned the Drake gRPC service (C++ side). CI/CD integration was mostly me with help from our DevOps team for GitLab pipeline config. The plugin system was designed so other engineers could contribute plugins independently - 4 plugins were written by other team members after I established the protocol.

**Q: How long did this take to build?**
> The core sim (update loop, scene, behaviors, REST API) took about 3 months to get to a usable state. Drake integration added another 2 months. CI/CD pipeline and nightly workflows took about 1 month. After that, it was continuous improvement - new plugins, performance optimization, additional configs. Total from start to "running nightly in production" was about 6 months.

**Q: What would you do differently?**
> (1) Start with CI integration earlier - I built the sim first and added CI later, but the CI requirements should have driven the design from day 1. (2) Invest in a config validation tool earlier - many CI failures were just bad YAML configs. (3) Add structured logging from the start instead of retrofitting it. The architecture decisions (plugin system, deferred mutations, dual physics) were all correct and I'd make them again.
