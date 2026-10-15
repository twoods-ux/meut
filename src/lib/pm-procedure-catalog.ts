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
