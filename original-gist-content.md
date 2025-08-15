# Roster Actual Table Enhancement New Table & Debezium Solution

## 📊 **PROBLEM DIAGRAM**

**📊 Mermaid Diagram:**
```
flowchart TD
    A[MAIN PROBLEM<br/>Table Roster Actual needs enhancement<br/>for new requirement] --> B[NEW REQUIREMENT<br/>• Support for leave/permit per hour in middle of schedule<br/>• Needs reference to other tables<br/>• Current structure insufficient]
    
    style A fill:#ffcccc,stroke:#ff0000,stroke-width:2px
    style B fill:#fff2cc,stroke:#d6b656,stroke-width:2px
```

## 🎯 **SOLUTION OPTIONS COMPARISON**

**📊 Mermaid Diagram:**
```
graph TB
    subgraph "SOLUTION COMPARISON"
        A["🔧 GENERATED COLUMN<br/>❌ REJECTED<br/>━━━━━━━━━━━━━━━━━━━━<br/>✅ Most elegant<br/>✅ Auto-computed<br/>✅ No sync issues<br/>━━━━━━━━━━━━━━━━━━━━<br/>❌ Can't reference other tables<br/>❌ High complexity"]
        
        B["📝 ADD COLUMN + DEBEZIUM<br/>⚖️ OPTION 2<br/>━━━━━━━━━━━━━━━━━━━━<br/>✅ Simple implementation<br/>✅ Direct update<br/>━━━━━━━━━━━━━━━━━━━━<br/>❌ Loop risk<br/>❌ Config needed<br/>❌ Medium complexity"]
        
        C["🗄️ NEW TABLE + DEBEZIUM<br/>✅ RECOMMENDED<br/>━━━━━━━━━━━━━━━━━━━━<br/>✅ No loop risk<br/>✅ Clean design<br/>✅ Flexible<br/>━━━━━━━━━━━━━━━━━━━━<br/>❌ Extra joins<br/>❌ More complex queries"]
    end
    
    style A fill:#ffcccc,stroke:#ff0000,stroke-width:2px
    style B fill:#fff2cc,stroke:#d6b656,stroke-width:2px
    style C fill:#ccffcc,stroke:#00cc00,stroke-width:2px
```

## 🔄 **DECISION FLOW**

**📊 Mermaid Diagram:**
```
flowchart TD
    START[Need to enhance Table Roster Actual] --> OPT1[Option 1: Generated Column]
    OPT1 --> REJECT[❌ REJECTED<br/>Can't reference other tables<br/>for hourly leave/permit]
    
    REJECT --> DEBATE[Debate: Add Column vs New Table]
    
    DEBATE --> OPT2[ADD COLUMN + DEBEZIUM]
    DEBATE --> OPT3[NEW TABLE + DEBEZIUM]
    
    OPT2 --> PROS2[PROS:<br/>• Simple impl<br/>• Direct update]
    OPT2 --> CONS2[CONS:<br/>• Loop risk<br/>• Config needed]
    
    OPT3 --> PROS3[PROS:<br/>• No loop risk<br/>• Clean design]
    OPT3 --> CONS3[CONS:<br/>• Extra joins<br/>• More complex]
    
    PROS2 --> STATUS
    CONS2 --> STATUS
    PROS3 --> STATUS
    CONS3 --> STATUS
    
    STATUS[CURRENT DISCUSSION STATUS:<br/>• Debezium can handle both<br/>• Before/after tracking works<br/>• Team reconsidering options<br/>• Hanif prefers new table<br/>  avoids infinite loop]
    
    style START fill:#e1f5fe
    style REJECT fill:#ffcccc,stroke:#ff0000,stroke-width:2px
    style DEBATE fill:#fff2cc,stroke:#d6b656,stroke-width:2px
    style STATUS fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
```

## 🎯 **TEAM CONSENSUS TRACKING**

**📊 Mermaid Diagram:**
```
graph LR
    subgraph "TEAM POSITIONS"
        A[👨‍💼 Jeje Lead<br/>━━━━━━━━━━━━━━━━━━━━<br/>Initially: Add column + debezium<br/>Later: Reconsidering new table option]
        
        B[👨‍💻 Damar<br/>━━━━━━━━━━━━━━━━━━━━<br/>Confirmed: Debezium handles both well<br/>Before/after tracking capability]
        
        C[👨‍💻 Hanif<br/>━━━━━━━━━━━━━━━━━━━━<br/>Prefers: New table approach<br/>Reason: Avoids infinite loop risk<br/>Concern: Debezium config complexity]
    end
    
    A --> STATUS[⏳ STILL DECIDING]
    B --> STATUS
    C --> STATUS
    
    style A fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    style B fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    style C fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style STATUS fill:#fce4ec,stroke:#e91e63,stroke-width:2px
```

## 💡 **RECOMMENDED SOLUTION PATH**

**📊 Mermaid Diagram:**
```
flowchart TD
    REC[🎯 RECOMMENDED: NEW TABLE]
    
    REC --> RATIONALE[RATIONALE:<br/>✅ Avoids debezium infinite loop<br/>✅ Clean separation of concerns<br/>✅ Easier to maintain and debug<br/>✅ More flexible for future requirements<br/>✅ Debezium can handle table creation events well]
    
    RATIONALE --> IMPL[IMPLEMENTATION STEPS:]
    
    IMPL --> STEP1[1. Create new table: roster_actual_status]
    STEP1 --> STEP2[2. Setup debezium for new table]
    STEP2 --> STEP3[3. Handle join in queries where needed]
    STEP3 --> STEP4[4. No risk of infinite loops]
    
    style REC fill:#ccffcc,stroke:#00cc00,stroke-width:3px
    style RATIONALE fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    style IMPL fill:#fff2cc,stroke:#d6b656,stroke-width:2px
    style STEP1 fill:#e1f5fe,stroke:#0277bd,stroke-width:1px
    style STEP2 fill:#e1f5fe,stroke:#0277bd,stroke-width:1px
    style STEP3 fill:#e1f5fe,stroke:#0277bd,stroke-width:1px
    style STEP4 fill:#e1f5fe,stroke:#0277bd,stroke-width:1px
```

---

**Source:** Analysis from Zulip Dev BE channel discussion on "Table Roster Actual" topic  
**Date:** August 15, 2025  
**Participants:** Jeje (Lead), Damar, Hanif
