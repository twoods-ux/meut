/**
 * Editable starter PM templates for common hospital device types.
 *
 * Steps follow a typical biomed PM outline (visual inspection, IEC 62353-style
 * electrical safety readings, functional test, alarms, battery). Limits are
 * starting points, not an OEM procedure:
 * - Protective earth ≤ 0.3 Ω with the equipment power cord (IEC 62353).
 * - Class I equipment leakage ≤ 500 µA, direct or differential method.
 * Class II touch current is often 100 µA, and CF applied-part limits are lower.
 * Staff should edit limits to the standard and device class they actually test.
 */

export type StarterPmStep = {
  text: string;
  stepType: "PASS_FAIL" | "NUMERIC" | "NOTE";
  required: boolean;
  unit?: string;
  minValue?: number;
  maxValue?: number;
};

export type StarterPmProcedure = {
  seedKey: string;
  name: string;
  deviceType: string;
  aliases: string;
  manufacturer: string;
  model: string;
  notes: string;
  steps: StarterPmStep[];
};

const STARTER_INTRO =
  "Starter template — edit the steps, limits, and match fields (device type, manufacturer, model) to fit your program. These are generic industry-typical checks, not a manufacturer service procedure.";

const LIMIT_NOTE =
  "Electrical limits are typical IEC 62353 routine-test figures: protective earth ≤ 0.3 Ω measured with the power cord, and Class I equipment leakage ≤ 500 µA (direct or differential). Change them for Class II touch current (often 100 µA), applied-part type (B / BF / CF), or your written safety procedure.";

function visual(text: string): StarterPmStep {
  return { text, stepType: "PASS_FAIL", required: true };
}

function earth(): StarterPmStep {
  return {
    text: "Protective earth resistance. Record the highest reading (both polarities if using DC).",
    stepType: "NUMERIC",
    required: true,
    unit: "Ω",
    maxValue: 0.3,
  };
}

function leakage(required = true): StarterPmStep {
  return {
    text: "Equipment leakage current (direct or differential method). Record the highest reading.",
    stepType: "NUMERIC",
    required,
    unit: "µA",
    maxValue: 500,
  };
}

function noteStep(text: string): StarterPmStep {
  return {
    text,
    stepType: "NOTE",
    required: false,
  };
}

export const STARTER_PM_PROCEDURES: StarterPmProcedure[] = [
  {
    seedKey: "infusion-pump",
    name: "Infusion pump",
    deviceType: "Infusion pump",
    aliases: "IV pump, syringe pump, PCA pump",
    manufacturer: "",
    model: "",
    notes: `${STARTER_INTRO} ${LIMIT_NOTE}`,
    steps: [
      visual(
        "Visual inspection: housing, line cord, pole clamp, door, and fluid path are intact and clean."
      ),
      earth(),
      leakage(),
      visual(
        "Functional test: prime, flow, and occlusion response match the test setup."
      ),
      visual(
        "Alarm test: occlusion, air-in-line or door-open, and low-battery or infusion-complete as equipped."
      ),
      {
        text: "Battery: holds a charge and the battery indicator agrees with a short run-down or self-test.",
        stepType: "PASS_FAIL",
        required: true,
      },
      noteStep("Notes, parts replaced, or out-of-tolerance follow-up."),
    ],
  },
  {
    seedKey: "defibrillator",
    name: "Defibrillator",
    deviceType: "Defibrillator",
    aliases: "defib, AED",
    manufacturer: "",
    model: "",
    notes: `${STARTER_INTRO} Delivered-energy tolerance is device-specific — record the reading and compare it to the service manual. ${LIMIT_NOTE}`,
    steps: [
      visual(
        "Visual inspection: case, paddles or pads, cables, and ECG leads are intact."
      ),
      earth(),
      leakage(),
      {
        text: "Selected test energy.",
        stepType: "NUMERIC",
        required: true,
        unit: "J",
      },
      {
        text: "Delivered energy into a 50 Ω load at the selected setting.",
        stepType: "NUMERIC",
        required: true,
        unit: "J",
      },
      visual(
        "Delivered energy is within the tolerance in the service manual for that setting."
      ),
      visual("ECG display and sync (if equipped) respond to a simulator."),
      visual("User prompts, alarms, and recorder or event log function."),
      {
        text: "Battery capacity or self-test passes.",
        stepType: "PASS_FAIL",
        required: true,
      },
      noteStep("Notes, shocks delivered during test, or parts replaced."),
    ],
  },
  {
    seedKey: "patient-monitor",
    name: "Patient monitor",
    deviceType: "Patient monitor",
    aliases: "physiologic monitor, vital signs monitor",
    manufacturer: "",
    model: "",
    notes: `${STARTER_INTRO} ${LIMIT_NOTE}`,
    steps: [
      visual(
        "Visual inspection: display, modules, cables, and accessories are intact."
      ),
      earth(),
      leakage(),
      visual(
        "Functional test with a simulator: ECG, SpO2, and NIBP (as equipped) track the simulated values."
      ),
      {
        text: "NIBP displayed pressure at the test point, if NIBP is equipped.",
        stepType: "NUMERIC",
        required: false,
        unit: "mmHg",
      },
      visual("Alarm limits, audible alarm, and silence/reset behave as expected."),
      {
        text: "Battery operates and charges, if the monitor has a battery.",
        stepType: "PASS_FAIL",
        required: false,
      },
      noteStep("Notes or parameters not tested."),
    ],
  },
  {
    seedKey: "ventilator",
    name: "Ventilator",
    deviceType: "Ventilator",
    aliases: "vent",
    manufacturer: "",
    model: "",
    notes: `${STARTER_INTRO} Volume and pressure accuracy depend on the circuit and the set values — compare readings to the service manual rather than a single fixed limit. ${LIMIT_NOTE}`,
    steps: [
      visual(
        "Visual inspection: circuit, filters, humidifier, and power cord are correct and undamaged."
      ),
      earth(),
      leakage(),
      visual("Power-on self-test and circuit leak test pass."),
      {
        text: "Set tidal volume for the accuracy check.",
        stepType: "NUMERIC",
        required: true,
        unit: "mL",
      },
      {
        text: "Measured tidal volume at the set value.",
        stepType: "NUMERIC",
        required: true,
        unit: "mL",
      },
      visual(
        "Measured volume and pressure are within the service-manual tolerance."
      ),
      visual(
        "Alarm test: disconnect, high pressure, and low minute volume (or equivalent)."
      ),
      {
        text: "Internal battery supports ventilation per the self-test or a short run.",
        stepType: "PASS_FAIL",
        required: true,
      },
      noteStep("Notes, circuit used, or oxygen sensor status."),
    ],
  },
  {
    seedKey: "ecg",
    name: "ECG",
    deviceType: "ECG",
    aliases: "EKG, electrocardiograph, electrocardiogram",
    manufacturer: "",
    model: "",
    notes: `${STARTER_INTRO} ${LIMIT_NOTE}`,
    steps: [
      visual("Visual inspection: patient cable, lead wires, clips, and cart are intact."),
      earth(),
      leakage(),
      visual("Simulator trace: each lead shows a clean complex and no open-lead alarm."),
      {
        text: "Simulator heart rate.",
        stepType: "NUMERIC",
        required: true,
        unit: "bpm",
      },
      {
        text: "Displayed or printed heart rate.",
        stepType: "NUMERIC",
        required: true,
        unit: "bpm",
      },
      visual("Paper speed, gain, and printer or on-screen record are acceptable."),
      {
        text: "Battery operates, if the unit is portable.",
        stepType: "PASS_FAIL",
        required: false,
      },
      noteStep("Notes or leads not tested."),
    ],
  },
  {
    seedKey: "electrosurgical-unit",
    name: "Electrosurgical unit",
    deviceType: "Electrosurgical unit",
    aliases: "electrosurgical generator, ESU",
    manufacturer: "",
    model: "",
    notes: `${STARTER_INTRO} Output watts are recorded at your test settings. Accept them against the service manual; this starter does not assume one power level. ${LIMIT_NOTE}`,
    steps: [
      visual(
        "Visual inspection: pencils, return electrode, footswitch, and cables are intact."
      ),
      earth(),
      leakage(),
      {
        text: "Cut output at the test setting.",
        stepType: "NUMERIC",
        required: true,
        unit: "W",
      },
      {
        text: "Coag output at the test setting.",
        stepType: "NUMERIC",
        required: true,
        unit: "W",
      },
      visual(
        "Cut and coag output are within the service-manual tolerance at those settings."
      ),
      visual(
        "Return-electrode monitor alarms when the return path is open or out of range."
      ),
      visual("Handswitch and footswitch activate the expected mode."),
      noteStep("Notes, test load used, or accessories checked."),
    ],
  },
  {
    seedKey: "suction",
    name: "Suction",
    deviceType: "Suction",
    aliases: "suction pump, aspirator, vacuum regulator",
    manufacturer: "",
    model: "",
    notes: `${STARTER_INTRO} Electrical readings apply to mains-powered pumps. Skip them for a pipeline vacuum regulator and mark the step with a note if you add one. ${LIMIT_NOTE}`,
    steps: [
      visual(
        "Visual inspection: canister, tubing, filter, and overflow protection are intact."
      ),
      {
        ...earth(),
        required: false,
        text: "Protective earth resistance, if the unit is mains powered. Record the highest reading.",
      },
      {
        ...leakage(false),
        text: "Equipment leakage current, if the unit is mains powered.",
      },
      visual("Vacuum builds and holds at the test setting."),
      {
        text: "Vacuum achieved at the test setting.",
        stepType: "NUMERIC",
        required: true,
        unit: "mmHg",
      },
      {
        text: "Overflow shutoff or gauge accuracy, if equipped.",
        stepType: "PASS_FAIL",
        required: false,
      },
      noteStep("Notes or collection accessories replaced."),
    ],
  },
  {
    seedKey: "tosoh-g8-hba1c",
    name: "Tosoh G8 HbA1c analyzer",
    deviceType: "HbA1c analyzer",
    aliases: "A1c analyzer, G8, HLC-723G8, Tosoh G8",
    manufacturer: "Tosoh",
    model: "HLC-723G8",
    notes: `${STARTER_INTRO} Outline follows the HLC-723G8 Service Manual Rev. F, section 9 (annual or every 20,000 tests). Use the manual sections noted on each step for the detailed method. Wear gloves for all wetted-path work. ${LIMIT_NOTE}`,
    steps: [
      visual("Visual inspection: covers, display, power cord, and tubing intact; no salt or reagent deposits."),
      {
        text: "Injection count at start of PM (service screen, manual 5.3).",
        stepType: "NUMERIC",
        required: false,
        unit: "tests",
      },
      visual("Suction filters replaced on schedule (every 6 months, user manual 5.9)."),
      {
        text: "Filter element count; replace the element at 400 tests or more (user manual 5.7).",
        stepType: "NUMERIC",
        required: true,
        unit: "tests",
        maxValue: 400,
      },
      visual("Line filter and filter element replaced or checked; no clogging or high pressure."),
      visual("Column count and expiry checked; column replaced if due (per column IDS)."),
      visual("Reagent and elution buffer levels and expiry checked; hemolysis/wash solution adequate."),
      visual("Drain valve O-ring not worn and no leak (6.14.1)."),
      visual("Needle block O-rings replaced; needle and holder plate reinstalled (6.4.2)."),
      visual("Wash block / dilution port clean; replaced if stains will not clean (6.13)."),
      visual("Sampling arm Y and Z axes cleaned and greased with AFC grease (9.3.1)."),
      visual("Needle piercing position checked with a primary tube; adjusted if offset (2.7, 4.7)."),
      visual("Injection valve rotor seal, stator face, and sample loop replaced (6.7.1, 9.3.2)."),
      visual("Rotary valve rotor seal replaced; coupling screws tight (6.5.1, 6.5.3)."),
      visual("High-pressure pump plunger seal replaced; check valves flow freely (6.8.1, 9.3.3)."),
      visual("Leak check under flow at all joints and serviced parts; pressure normal (9.3.4)."),
      {
        text: "Pump pressure during leak check.",
        stepType: "NUMERIC",
        required: false,
        unit: "MPa",
      },
      visual("Solenoid valves open and close correctly (9.3.5)."),
      visual("5 mL syringe (left) inspected: no leak, bubbles, or binding; SYL-U / SYL-D switches operate."),
      visual("250 µL syringe (right) inspected: no leak, bubbles, or binding."),
      visual("Syringe Teflon tips / caps checked and replaced (9.3.6)."),
      visual("Syringe shaft and feed screw cleaned with wiper and lightly oiled; moves smoothly end to end (9.3.7)."),
      visual("Degasser vacuum pump operates periodically (6.12.3)."),
      {
        text: "Detector signal (DET value) (5.3; adjust per 6.10.4).",
        stepType: "NUMERIC",
        required: true,
        unit: "mV",
        minValue: 0,
        maxValue: 50,
      },
      {
        text: "Column oven temperature (9.3.8; default set point 25 °C).",
        stepType: "NUMERIC",
        required: true,
        unit: "°C",
      },
      visual("Sample loader: tube sensor, rack latch, pitch sensor, end-marker, and bar-code reader work; loader cleaned (6.21)."),
      visual("Printer prints clearly; paper loaded."),
      {
        text: "Whole blood TOTAL AREA (9.3.9; acceptable 700 to 2500).",
        stepType: "NUMERIC",
        required: true,
        minValue: 700,
        maxValue: 2500,
      },
      visual("s-A1c retention time within column IDS range; FLOW FACTOR adjusted if needed."),
      visual("Calibration performed and accepted."),
      visual("Control materials run; all levels within acceptable ranges."),
      visual("Results transmit to the LIS / host (test result received)."),
      earth(),
      leakage(),
      noteStep("Notes, parts replaced, and final injection count."),
    ],
  },
  {
    seedKey: "electrical-safety",
    name: "General electrical safety",
    deviceType: "",
    aliases: "",
    manufacturer: "",
    model: "",
    notes: `${STARTER_INTRO} This starter does not auto-match inventory until you set a device type, manufacturer, or model. Use it as a base, or pin it onto specific equipment from the match preview. ${LIMIT_NOTE}`,
    steps: [
      visual(
        "Visual inspection: enclosure, controls, line cord, and strain relief are intact."
      ),
      earth(),
      leakage(),
      {
        text: "Patient or applied-part leakage, when the device has patient connections. Use the limit for the applied-part type you test.",
        stepType: "NUMERIC",
        required: false,
        unit: "µA",
        maxValue: 100,
      },
      visual("Primary function operates through a normal cycle."),
      visual("Indicators and alarms operate."),
      {
        text: "Battery operates, if equipped.",
        stepType: "PASS_FAIL",
        required: false,
      },
      noteStep("Notes, standard used, or limits adjusted for this device class."),
    ],
  },
];
