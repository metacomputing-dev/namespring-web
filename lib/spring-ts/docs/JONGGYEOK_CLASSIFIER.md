# Jonggyeok Classifier v1

The v1 jonggyeok classifier is an evidence surface, not a replacement for the
default gyeokguk selector.

## Scope

The classifier emits eight candidate subtypes:

- `cong_cai`
- `cong_guan`
- `cong_sha`
- `cong_er`
- `cong_yin`
- `cong_bi`
- `zhuan_wang`
- `hua_qi`

Each candidate carries normalized evidence fields:

- `followPressure`
- `dayMasterIsolation`
- `rootWeakness`
- `dominantElementShare`
- `breakerPenalty`

The status can be `none`, `possible`, `candidate`, `blocked`, or `selected`.
In default mode, `selected` is rare by design: the classifier only reports
`selected` if the existing gyeokguk ranking already selected the same special
frame. It never promotes a regular chart into jonggyeok on its own.

## Selection Policy

Jonggyeok doctrine is sensitive to school-specific readings, hidden-stem
exposure, roots, month command, purity, and breaker conditions. Existing T1
fixtures in this repository are training-derived hypothesis records, not
authority-truth fixtures. For that reason, v1 uses those fixtures as
observation-only coverage:

- The fixture's doctrinal subtype should be visible as a candidate row.
- The fixture must not force the engine to classify that subtype as truth.
- Regular baseline charts must not acquire `selected` jonggyeok status.

## Evidence Formula

Cong-style candidates combine role pressure, ten-god group share, day-master
isolation, root weakness, and the dominant target element. Visible day-master
support, mixed pressure, month-gyeok breakage, or weak target dominance can
move a candidate to `blocked`.

`zhuan_wang` uses one-element concentration and requires the dominant element
to match the day master before the evidence is treated as clean.

`hua_qi` uses the transformation signal and treats day-master involvement as a
conservative gate.

The output is deliberately additive. It is safe for diagnostics, metrics, and
future source-tiered review without changing default user-facing selection.
