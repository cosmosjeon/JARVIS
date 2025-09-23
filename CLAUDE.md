# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains documentation focused on software engineering best practices, specifically:
- **Clean Code Guidelines** (`vooster-docs/clean-code.md`)
- **TDD Process Guidelines** (`vooster-docs/tdd.md`)
- **Step-by-Step Implementation Process** (`vooster-docs/step-by-step.md`)

## Development Philosophy

This codebase follows strict engineering principles with mandatory processes:

### Required Implementation Process
**EVERY implementation and modification MUST follow this three-phase approach:**

1. **Phase 1: Codebase Exploration & Analysis**
   - Systematic file discovery and examination
   - Convention and style analysis
   - Document all findings in structured format

2. **Phase 2: Implementation Planning**
   - Create detailed roadmap based on Phase 1 findings
   - Define specific tasks and acceptance criteria
   - Structure plan by modules

3. **Phase 3: Implementation Execution**
   - Implement following established conventions
   - Verify all acceptance criteria before proceeding
   - Maintain minimalistic approach with expert-level standards

### TDD Requirements
- **Mandatory Red → Green → Refactor cycle** for all code changes
- Write failing test FIRST, then minimal code to pass
- Follow FIRST principles: Fast, Independent, Repeatable, Self-validating, Timely
- Use AAA pattern: Arrange, Act, Assert
- Test Pyramid: 70% Unit, 20% Integration, 10% Acceptance

### Code Quality Standards
- **SOLID principles** consistently applied
- **DRY, KISS, YAGNI** principles enforced
- Maximum function length: 20 lines (prefer under 10)
- Maximum 3 parameters per function
- Cyclomatic complexity < 10
- Maximum nesting depth: 3 levels
- Test coverage > 80%

### Naming Conventions
- Classes: nouns
- Methods: verbs
- Booleans: is/has/can prefix
- Constants: UPPER_SNAKE_CASE
- No magic numbers - use named constants

### Security & Best Practices
- Never trust user input
- Use parameterized queries
- Follow principle of least privilege
- No secrets in code
- Atomic commits with imperative mood messages

## Quality Gates
Before any commit, ensure:
- [ ] All tests pass
- [ ] No linting errors
- [ ] No console logs
- [ ] No commented code
- [ ] No TODOs without tickets
- [ ] Performance acceptable
- [ ] Security considered

## Key Files
- `vooster-docs/clean-code.md` - Comprehensive clean code principles and checklist
- `vooster-docs/tdd.md` - Mandatory TDD process with team practices
- `vooster-docs/step-by-step.md` - Required three-phase implementation approach