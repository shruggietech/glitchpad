# Release Requirements Checklist: v0.2.0 Image Release Publication

**Purpose**: Reviewer assessment of release authority, source identity, complete evidence, and recovery requirements. **Created**: 2026-11-02 **Feature**: [spec.md](../spec.md)

**Review Ownership**: Reviewer-owned requirements-quality artifact. An [x] means requirements quality was reviewed and satisfied, not implementation completion. Generated items remain unchecked.

## Completeness and clarity

- [ ] CHK001 Are the eight packages and 14 public assets defined without ambiguous inventory? [Completeness, Spec §FR-004, §SC-002]
- [ ] CHK002 Is qualification tied to an exact source before the tag is created? [Clarity, Spec §FR-002]
- [ ] CHK003 Is publish-before-final-merge authority distinguished from merge authority? [Consistency, Spec §FR-009]
- [ ] CHK004 Are dependency preparation and final provenance failure behaviors fully specified? [Coverage, Spec §FR-003]

## Acceptance and exception coverage

- [ ] CHK005 Are byte, source, version, signing status, attestation, and public site acceptance criteria measurable? [Measurability, Spec §FR-004, §FR-005, §SC-002]
- [ ] CHK006 Are partial publication and existing tag/asset conflicts addressed without silent replacement? [Coverage, Spec §FR-010, §Edge Cases]
- [ ] CHK007 Are all received review comments and the two-round cap covered? [Completeness, Spec §FR-008, §SC-003]
- [ ] CHK008 Are historical evidence and newly qualified source kept distinct? [Consistency, Spec §Assumptions, §FR-002]

## Dependencies and truthful limitations

- [ ] CHK009 Are excluded dependency/PDF work and issue-level dispositions explicit? [Scope, Spec §FR-001, §SC-004]
- [ ] CHK010 Are unperformed manual rows and hosted/reference startup classifications distinguished? [Clarity, Spec §FR-007]
- [ ] CHK011 Are failed campaigns and missing security-bot receipts accounted for? [Coverage, Spec §Edge Cases, §FR-007]
- [ ] CHK012 Does the final owner handoff require an open PR and state remaining deviations? [Completeness, Spec §FR-009, §SC-005]

## Notes

Standard depth, PR reviewer audience, release identity and provenance focus. Autopilot proceeds with a recorded assessment in plan.md and preserves reviewer markers. The implement phase reads this state without modifying it.
