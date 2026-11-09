import test from "node:test";
import assert from "node:assert/strict";

// Funkcje klasyfikacji klinicznej i norm
function getBloodPressureStage(sap) {
  if (sap < 140) return "normal";
  if (sap < 160) return "prehypertension";
  if (sap < 180) return "hypertension";
  return "severe";
}

function getGlucoseStatus(mgDl) {
  if (mgDl < 70) return "hypo";
  if (mgDl <= 150) return "normal";
  if (mgDl <= 180) return "elevated";
  return "hyper";
}

function getTemperatureStatus(celsius) {
  if (celsius < 37.5) return "hypothermia";
  if (celsius <= 39.0) return "normal";
  if (celsius <= 39.4) return "subfebrile";
  return "fever";
}

function mgDlToMmolL(mgDl) {
  return Number((mgDl / 18.0182).toFixed(1));
}

function mmolLToMgDl(mmolL) {
  return Math.round(mmolL * 18.0182);
}

test("Blood Pressure staging according to ACVIM / IRIS", () => {
  // Poniżej 140 mmHg - norma
  assert.equal(getBloodPressureStage(110), "normal");
  assert.equal(getBloodPressureStage(139), "normal");

  // 140 - 159 mmHg - stan graniczny / przednadciśnieniowy
  assert.equal(getBloodPressureStage(140), "prehypertension");
  assert.equal(getBloodPressureStage(155), "prehypertension");
  assert.equal(getBloodPressureStage(159), "prehypertension");

  // 160 - 179 mmHg - nadciśnienie tętnicze
  assert.equal(getBloodPressureStage(160), "hypertension");
  assert.equal(getBloodPressureStage(175), "hypertension");

  // 180+ mmHg - ciężkie nadciśnienie
  assert.equal(getBloodPressureStage(180), "severe");
  assert.equal(getBloodPressureStage(210), "severe");
});

test("Glucose physiological range and alert thresholds", () => {
  // Hipoglikemia (< 70 mg/dL)
  assert.equal(getGlucoseStatus(45), "hypo");
  assert.equal(getGlucoseStatus(69), "hypo");

  // Norma fizjologiczna (70 - 150 mg/dL)
  assert.equal(getGlucoseStatus(70), "normal");
  assert.equal(getGlucoseStatus(100), "normal");
  assert.equal(getGlucoseStatus(150), "normal");

  // Podwyższona / reakcja stresowa (151 - 180 mg/dL)
  assert.equal(getGlucoseStatus(151), "elevated");
  assert.equal(getGlucoseStatus(175), "elevated");

  // Hiperglikemia / powyżej progu nerkowego (> 180 mg/dL)
  assert.equal(getGlucoseStatus(181), "hyper");
  assert.equal(getGlucoseStatus(320), "hyper");
});

test("Glucose unit conversion between mg/dL and mmol/L", () => {
  // 100 mg/dL ≈ 5.5 mmol/L
  assert.equal(mgDlToMmolL(100), 5.5);
  // 180 mg/dL ≈ 10.0 mmol/L
  assert.equal(mgDlToMmolL(180), 10.0);
  // 5.55 mmol/L ≈ 100 mg/dL
  assert.equal(mmolLToMgDl(5.55), 100);
});

test("Body temperature physiological ranges for dogs and cats", () => {
  // Hipotermia (< 37.5 °C)
  assert.equal(getTemperatureStatus(36.8), "hypothermia");
  assert.equal(getTemperatureStatus(37.4), "hypothermia");

  // Prawidłowa temperatura fizjologiczna (37.5 - 39.0 °C)
  assert.equal(getTemperatureStatus(37.5), "normal");
  assert.equal(getTemperatureStatus(38.4), "normal");
  assert.equal(getTemperatureStatus(39.0), "normal");

  // Stan podgorączkowy (39.1 - 39.4 °C)
  assert.equal(getTemperatureStatus(39.1), "subfebrile");
  assert.equal(getTemperatureStatus(39.3), "subfebrile");

  // Gorączka (>= 39.5 °C)
  assert.equal(getTemperatureStatus(39.5), "fever");
  assert.equal(getTemperatureStatus(40.2), "fever");
});

test("Fluid therapy parameters validation", () => {
  function validateFluid(params) {
    const validRoutes = ["iv", "sc", "io"];
    const validLocations = ["clinic", "home"];
    const vol = Number(params.volume_ml);
    if (!params.fluid_name || params.fluid_name.trim().length < 2) return false;
    if (isNaN(vol) || vol <= 0 || vol > 5000) return false;
    if (!validRoutes.includes(params.route)) return false;
    if (!validLocations.includes(params.location)) return false;
    return true;
  }

  // Poprawny wlew dożylny z lekami
  assert.equal(
    validateFluid({
      fluid_name: "PWE (Płyn wieloelektrolitowy)",
      volume_ml: 120,
      route: "iv",
      location: "clinic",
    }),
    true
  );

  // Poprawny wlew podskórny w domu
  assert.equal(
    validateFluid({
      fluid_name: "NaCl 0.9%",
      volume_ml: 100,
      route: "sc",
      location: "home",
    }),
    true
  );

  // Błędna objętość lub droga
  assert.equal(
    validateFluid({
      fluid_name: "PWE",
      volume_ml: 0,
      route: "iv",
      location: "clinic",
    }),
    false
  );
  assert.equal(
    validateFluid({
      fluid_name: "PWE",
      volume_ml: 100,
      route: "oral",
      location: "clinic",
    }),
    false
  );
});
