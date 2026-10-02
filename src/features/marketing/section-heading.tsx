import { Badge } from "@/components/ui/badge";

export function SectionHeading({
  id,
  badge,
  title,
  description,
}: {
  id: string;
  badge: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-heading">
      <Badge dot className="eyebrow">
        {badge}
      </Badge>
      <h2 id={id}>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
