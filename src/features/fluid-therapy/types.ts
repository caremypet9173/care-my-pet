export type FluidRoute = "iv" | "sc" | "io";
export type FluidLocation = "clinic" | "home";

export interface PetFluidTherapy {
  id: string;
  pet_id: string;
  household_id: string;
  fluid_name: string;
  volume_ml: number;
  route: FluidRoute;
  medications_added: string;
  location: FluidLocation;
  clinic_name: string;
  doctor_name: string;
  catheter_status: string;
  administered_at: string;
  administered_on: string;
  notes: string;
  revision: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const COMMON_FLUIDS = [
  { value: "PWE (Płyn wieloelektrolitowy)", label: "PWE (Płyn wieloelektrolitowy)" },
  { value: "NaCl 0.9% (Sól fizjologiczna)", label: "NaCl 0.9% (Sól fizjologiczna)" },
  { value: "Płyn Ringera z mleczanami (LRS)", label: "Płyn Ringera z mleczanami (LRS)" },
  { value: "Płyn Ringera (zwykły)", label: "Płyn Ringera (zwykły)" },
  { value: "Glukoza 5%", label: "Glukoza 5%" },
  { value: "Sterofundin ISO", label: "Sterofundin ISO" },
  { value: "Plasmalyte", label: "Plasmalyte" },
  { value: "Duphalyte + PWE", label: "Duphalyte + PWE" },
];
