import { notFound } from "next/navigation";
import { getPet } from "@/features/pets/data";
import { ReviewForm } from "@/features/medical/review-form";
import "@/styles/medical.css";
export default async function NewReportPage({params}:{params:Promise<{id:string}>}) {
  const pet=await getPet((await params).id);if(!pet)notFound();
  return <ReviewForm pet={pet}/>;
}
