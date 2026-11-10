# CrimeScope working checklist

Current state after the repository cleanup on 2026-11-10. Historical implementation
details remain in [`WORK_LOG.md`](WORK_LOG.md); current instructions live in the root
[`README.md`](../README.md), [methodology](../docs/methodology.md), [findings](../docs/findings.md),
and [run/handoff guide](../docs/handoff.md).

## Active product

- [x] Express API and React dashboard use the frozen 2021–2024 serving release.
- [x] Current analysis pointer selects the v4 2024 cohort run.
- [x] Findings and presentation exporter verify the consumed artifact hashes.
- [x] Source downloader and canonical build select all 144 verified 2021–2024 fragments.
- [x] Course-method runners are documented as a separate multi-year workflow.
- [x] One retained demo walkthrough includes all nine routes and its original run IDs.

## Standard checks

- [x] Python, JavaScript tests, and production builds pass at the pre-cleanup baseline.
- [ ] Re-run Python and JavaScript tests and production builds after cleanup edits.
- [ ] Run browser smoke with both local services and the active artifacts.
- [ ] Dry-run the handoff package and inspect exclusions.

Check marks distinguish prior baseline results from checks still to run after this
cleanup. Update this list after the final verification pass.
