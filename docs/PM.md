# PM schedule & checklist

## Equipment fields

| Field | Purpose |
|-------|---------|
| `onPm` | Device is on a PM program |
| `pmSchedule1` | Interval code: **M** monthly, **Q** quarterly, **S** semi-annual, **A** annual |
| `pmProc1` | Procedure text (one step per line → checklist) |
| `techAssigned1` | Default tech code for generated PM WOs |
| `pmNextDue` | Next due date (editable; set on import when a next-due column exists) |
| `pmLastCompleted` | Last successful Pass close |

## Next-due bump rule

When a **PM** work order is closed with overall result **Pass**:

1. Set `pmLastCompleted` to the close timestamp.
2. Set `pmNextDue` = close date + interval from `pmSchedule1` (WO value, else equipment):
   - **M** / Monthly → +1 month
   - **Q** / Quarterly → +3 months
   - **S** / Semi-Annual → +6 months
   - **A** / Annual → +12 months
   - Unknown / empty → **+1 month** (default)

Fail closes do not change next due or last completed.

## Checklist

Generating facility-scoped PM WOs copies `pmProc1` into the WO and seeds `pmChecklist` JSON steps (`id`, `text`, `done`, `result`). Techs mark Done / Pass / Fail per step on the PM detail page and printout; overall Pass/Fail remains required on close.
