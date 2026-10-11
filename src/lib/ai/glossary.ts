/**
 * General educational descriptions of common laboratory tests.
 *
 * This is background information only: it describes what a test generally
 * measures and what a single result cannot establish. It never contains
 * reference intervals (those always come from the user's own report) and must
 * be reviewed by a qualified clinician before production release.
 */
export interface TestInfo {
  name: string;
  measures: string;
  cannotEstablish: string;
  terms?: Record<string, string>;
}

export const TEST_GLOSSARY: Record<string, TestInfo> = {
  hemoglobin: {
    name: "Hemoglobin",
    measures: "Hemoglobin is the protein in red blood cells that carries oxygen. The test measures how much of it is in a volume of blood.",
    cannotEstablish: "A single hemoglobin value cannot tell you why it is where it is. Hydration, recent illness, altitude and many other factors can affect it.",
    terms: { "g/dL": "grams per decilitre – the amount in a tenth of a litre of blood" },
  },
  tsh: {
    name: "TSH (thyroid-stimulating hormone)",
    measures: "TSH is a hormone from the pituitary gland that signals the thyroid. It is commonly used as one part of assessing thyroid function.",
    cannotEstablish: "TSH alone does not establish a thyroid condition. It is usually interpreted together with other thyroid tests, symptoms, medicines and timing.",
    terms: { "mIU/L": "milli-international units per litre", pituitary: "a small gland at the base of the brain that releases hormones" },
  },
  hba1c: {
    name: "HbA1c (glycated hemoglobin)",
    measures: "HbA1c reflects the share of hemoglobin that has glucose attached. It gives a picture of average blood glucose over roughly the previous two to three months.",
    cannotEstablish: "HbA1c can be affected by conditions that change red blood cell lifespan. A single result does not on its own establish a diagnosis.",
    terms: { "%": "percentage of hemoglobin with glucose attached", glycated: "with glucose attached" },
  },
  "25ohvitamind": {
    name: "25-OH Vitamin D",
    measures: "This test measures 25-hydroxyvitamin D, the main circulating form of vitamin D in the blood.",
    cannotEstablish: "Labs and guidelines use different cut-offs, and levels vary with season and sun exposure. The result alone does not say what, if anything, should be done.",
    terms: { "ng/mL": "nanograms per millilitre", "nmol/L": "nanomoles per litre – a different unit; values are not directly comparable with ng/mL" },
  },
  vitaminb12: {
    name: "Vitamin B12",
    measures: "This test measures the amount of vitamin B12 (cobalamin) in the blood.",
    cannotEstablish: "Blood B12 does not always reflect what is available to the body's tissues; clinicians sometimes use additional tests.",
    terms: { "pg/mL": "picograms per millilitre" },
  },
  plateletcount: {
    name: "Platelet count",
    measures: "Platelets are small cell fragments involved in blood clotting. The test counts how many are in a volume of blood.",
    cannotEstablish: "Counts can be affected by how the sample was handled, recent infection and medicines. One count alone does not explain a cause.",
  },
  creatinine: {
    name: "Creatinine",
    measures: "Creatinine is a waste product from muscle activity, filtered by the kidneys. It is used as one input when assessing kidney function.",
    cannotEstablish: "Creatinine depends on muscle mass, hydration, diet and other factors. It is usually interpreted alongside other measures such as eGFR.",
  },
  ldlcholesterol: {
    name: "LDL cholesterol",
    measures: "LDL cholesterol is a type of cholesterol carried in the blood by low-density lipoproteins.",
    cannotEstablish: "How an LDL value matters depends on a person's overall situation, which a single number does not capture.",
  },
  wbc: {
    name: "White blood cell count",
    measures: "White blood cells are part of the immune system. The test counts how many are in a volume of blood.",
    cannotEstablish: "Counts change with infection, stress, exercise and medicines. A single count does not explain a cause.",
  },
  totalwbccount: {
    name: "White blood cell count",
    measures: "White blood cells are part of the immune system. The test counts how many are in a volume of blood.",
    cannotEstablish: "Counts change with infection, stress, exercise and medicines. A single count does not explain a cause.",
  },
  fastingglucose: {
    name: "Fasting glucose",
    measures: "This measures the amount of glucose (sugar) in the blood after a period without food.",
    cannotEstablish: "Glucose varies with timing, recent food, illness and stress. One result alone does not establish a diagnosis.",
  },
  ferritin: {
    name: "Ferritin",
    measures: "Ferritin is a protein that stores iron. Blood ferritin is often used as an indication of the body's iron stores.",
    cannotEstablish: "Ferritin can rise with inflammation, so it does not always reflect iron stores on its own.",
  },
};

export const GENERAL_TERMS: Record<string, string> = {
  "reference interval": "The range the laboratory uses for comparison, usually based on a healthy reference group. Being outside it does not by itself mean something is wrong, and being inside it does not rule everything out.",
  flag: "A mark (such as H or L) the laboratory adds when a result is outside its reference interval.",
  "CBC": "Complete blood count – a group of tests about red cells, white cells and platelets.",
};
