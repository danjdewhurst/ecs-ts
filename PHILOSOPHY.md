## **ECS Engine Constitution & Principles**

### **1. Purity of Purpose**

- **Entities are IDs, and nothing more.**  
  No logic, no state beyond a unique identifier.
- **Components are pure data.**  
  Components must never contain behaviour. If in doubt, split logic from data.

### **2. System-Driven Behaviour**

- **All game logic belongs in systems.**  
  Only systems update, process, or apply behaviour. This is non-negotiable.
- **Behaviours are composable.**  
  Adding features should mean adding new systems or components, not changing what’s already written.

### **3. Data-Driven Design**

- **Optimise for cache locality and performance.**  
  Store similar components together. Prioritise memory layout and data access patterns that scale with thousands of entities.
- **Profile often, optimise performance bottlenecks, and avoid premature optimisation.**

### **4. Modularity & Extensibility**

- **Each system, component, and entity must adhere to the Single Responsibility Principle.**
- **Open for extension, closed for modification.**  
  New features are added by composing new entities from existing components—not rewriting old systems.

### **5. Developer Ergonomics**

- **APIs must be simple, focused, and avoid boilerplate.**
- **Favour clarity over cleverness.**  
  Code should be self-explanatory, not require expert-level ECS knowledge to extend or understand.
- **Readability is mandatory; comments explain ‘why’, not ‘what’.**

### **6. Robust Tooling Culture**

- **Debugging, profiling, and tracing are first-class citizens.**
- **If you break a profiling build or debugger, you must fix it.**  
  Never leave tooling broken or incomplete.

### **7. Scalability and Parallelism**

- **Architect for parallel execution.**  
  Any system that can run in parallel, must be safe to do so.
- **Race conditions and data hazards are unacceptable.**  
  Document and defend all multithreaded assumptions.

### **8. Testing and Continuous Integration**

- **Thoroughly test new systems and components, especially at their boundaries.**
- **No code reaches `main` without passing all established checks, tests, and linters.**

### **9. Documentation & Knowledge Sharing**

- **Document every component, system, and architectural decision.**  
  Contributors must be able to understand and critique any part of the codebase with written guidance.
- **Major design choices must be recorded in the repo via decision log or ADRs (Architectural Decision Records).**

### **10. Community & Respect**

- **Critique code, never people.**  
  Our mutual goal is building something great, not being ‘right’.
- **Encourage discussions, RFCs, and technical debate.**  
  All major engine evolutions must be discussed publicly before being merged.

---

### **Summary Statement**

_"This engine is built on the principle that simplicity, composability, and data-oriented design create robust, scalable, high-performance games. We treat tooling, documentation, and developer experience as core features. All contributors are custodians of this philosophy—accountable to its vision and to each other."_
