# School Preset Matrix

PR-7.4 keeps the original `korean`, `chinese`, and `modern` preset names for
backward compatibility and adds three operator-facing lenses:
`korean_modern`, `classical_text`, and `naming_safe`.

All presets are deterministic configuration, not source-truth claims. Passing
`schoolPreset` records the selected lens in report metadata. It changes scoring
only when `precisionConfig.useSchoolPreset === true`.

| `schoolPreset` | Use when | Main tradeoff |
| --- | --- | --- |
| `korean` | You need the production-compatible baseline. | Zero-op when `useSchoolPreset:true`; best for regression checks. |
| `chinese` | You want the legacy traditional Chinese structure lens. | Raises structure and command-rule influence. |
| `modern` | You need the original modern integrated lens. | Raises climate and seasonal balance. |
| `korean_modern` | You want contemporary Korean naming-service behavior. | Better Hangul-era fit, less strict classical-text emphasis. |
| `classical_text` | You want a public classical-source rule lens. | Highlights gyeokguk, disease-remedy, and bridge logic; not authority accuracy. |
| `naming_safe` | You want conservative ranking for production review. | Prefers balance and conflict avoidance over aggressive reinforcement. |

## Metadata

Engine responses surface the selected lens as report-wide metadata:

```json
{
  "selected": "classical_text",
  "source": "request",
  "useSchoolPreset": true,
  "label": "Classical Text",
  "doctrine": "public_classical_text_rule_lens",
  "tradeoffs": [
    "Highlights source-text rule features such as gyeokguk, disease-remedy, and bridge logic.",
    "Runtime deltas are comparison signals only, not authority accuracy."
  ],
  "scoringEffect": "active"
}
```

`source` is `default` only when the caller omits `schoolPreset`, and `request`
when the caller selects a known preset. An explicit unknown value fails closed
with `SAJU_UNKNOWN_SCHOOL_PRESET`; it never selects `korean` on the caller's
behalf. The historical `fallback` source remains in the public type only for
reading stored legacy responses and is not emitted by new runtime responses.

## Metrics

`metrics/bySourceTier.json` reports preset deltas against default-mode scoring.
The comparison is limited to scorable baseline fixtures because the current
authority casebooks are source-tiered but do not carry full
`birth + surname + givenName` naming-score inputs.
