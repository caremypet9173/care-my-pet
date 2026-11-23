"use client";
import { useLocale } from "next-intl";
import {
  IconScale,
  IconHeartRateMonitor,
  IconDroplet,
  IconTemperature,
  IconClock,
  IconHome,
  IconBriefcase,
  IconStethoscope,
  IconAlertCircle,
  IconInfoCircle,
  IconSparkles,
  IconFirstAidKit,
} from "@tabler/icons-react";
import type { MetricType } from "./types";

export function MeasurementTips({ activeType }: { activeType: MetricType }) {
  const pl = useLocale() === "pl";

  if (activeType === "blood_pressure") {
    return (
      <section className="weight-card">
        <h3>
          <IconHeartRateMonitor size={20} />
          {pl ? "Wskazówki pomiaru ciśnienia" : "Blood pressure tips"}
        </h3>
        {[
          {
            icon: IconClock,
            title: pl ? "5–10 min aklimatyzacji" : "5–10 min acclimation",
            text: pl
              ? "Przed pomiarem pupil powinien odpocząć w spokojnym, cichym pomieszczeniu bez hałasów."
              : "Allow the pet to rest in a quiet exam room before taking measurements.",
          },
          {
            icon: IconStethoscope,
            title: pl ? "Seria 3–5 pomiarów" : "Series of 3–5 readings",
            text: pl
              ? "Zawsze wykonuje się serię odczytów (często odrzucając pierwszy z powodu zaskoczenia) i wyciąga średnią."
              : "Take a series of measurements; discard the first if the pet was startled.",
          },
          {
            icon: IconAlertCircle,
            title: pl ? "Efekt białego fartucha" : "White-coat effect",
            text: pl
              ? "Stres w gabinecie może podnieść ciśnienie skurczowe nawet o 20–30 mmHg. Zapisuj kontekst badania."
              : "Veterinary clinic anxiety can raise systolic pressure significantly.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <div className="weight-tip" key={title}>
            <Icon size={18} />
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (activeType === "glucose") {
    return (
      <section className="weight-card">
        <h3>
          <IconDroplet size={20} />
          {pl ? "Monitorowanie glukozy w domu" : "Home glucose testing"}
        </h3>
        {[
          {
            icon: IconSparkles,
            title: pl ? "Nakłucie brzegu ucha" : "Ear prick technique",
            text: pl
              ? "U kotów i małych psów kroplę krwi pobiera się z naczynia brzeżnego ucha. Wcześniej rozgrzej ucho ciepłym gazikiem."
              : "Sample blood from the marginal ear vein; warm the ear gently beforehand.",
          },
          {
            icon: IconFirstAidKit,
            title: pl ? "Glukometr weterynaryjny" : "Pet glucometer",
            text: pl
              ? "Glukometry weterynaryjne (np. AlphaTrak) uwzględniają inną dystrybucję glukozy w krwinkach psów i kotów niż ludzkie."
              : "Veterinary meters are calibrated for pet red blood cell glucose distribution.",
          },
          {
            icon: IconAlertCircle,
            title: pl ? "Objawy hipoglikemii (<70)" : "Hypoglycemia alert (<70)",
            text: pl
              ? "Chwiejny chód, drgawki, otępienie – w razie podejrzenia natychmiast posmaruj dziąsła miodem i skontaktuj się z lekarzem!"
              : "Weakness or seizures require immediate honey on gums and veterinary contact.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <div className="weight-tip" key={title}>
            <Icon size={18} />
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (activeType === "temperature") {
    return (
      <section className="weight-card">
        <h3>
          <IconTemperature size={20} />
          {pl ? "Prawidłowy pomiar temperatury" : "Temperature measurement"}
        </h3>
        {[
          {
            icon: IconStethoscope,
            title: pl ? "Termometr elastyczny (flexible tip)" : "Flexible digital thermometer",
            text: pl
              ? "Używaj wyłącznie termometru cyfrowego z miękką, elastyczną końcówką dla bezpieczeństwa i komfortu pupila."
              : "Use a digital thermometer with a soft flexible tip for pet safety.",
          },
          {
            icon: IconInfoCircle,
            title: pl ? "Środek nawilżający" : "Use lubricant",
            text: pl
              ? "Posmaruj końcówkę wazeliną lub żelem medycznym i wprowadź delikatnie na głębokość ok. 1.5–2 cm."
              : "Apply petroleum jelly or medical lubricant before gentle insertion.",
          },
          {
            icon: IconAlertCircle,
            title: pl ? "Gorączka a wysiłek fizyczny" : "Fever vs exercise",
            text: pl
              ? "Po bieganiu lub w upale temperatura może wzrosnąć fizjologicznie. Mierz temperaturę w spoczynku."
              : "Measure during rest; vigorous play or hot weather temporarily raises temperature.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <div className="weight-tip" key={title}>
            <Icon size={18} />
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>
    );
  }

  // Waga (domyślne)
  return (
    <section className="weight-card">
      <h3>
        <IconScale size={20} />
        {pl ? "Wskazówki ważenia pupila w domu" : "Weighing your pet at home"}
      </h3>
      {[
        {
          icon: IconClock,
          title: pl ? "Stała pora i podobne warunki" : "Consistent time and conditions",
          text: pl
            ? "Porównuj pomiary wykonywane o podobnej porze (np. rano przed posiłkiem), na tej samej wadze."
            : "Compare measurements made at a similar time, using the same scale.",
        },
        {
          icon: IconHome,
          title: pl ? "Stabilne miejsce" : "A stable surface",
          text: pl
            ? "Ustaw wagę na równym, twardym podłożu. Poczekaj na stabilny odczyt."
            : "Place the scale on a level, hard surface and wait for a stable reading.",
        },
        {
          icon: IconBriefcase,
          title: pl ? "Pomiar z transporterem" : "Weighing with a carrier",
          text: pl
            ? "Zważ się z pupilem na rękach lub zważ transporter z pupilem i odejmij masę pustego transportera."
            : "Subtract the empty carrier weight from the combined weight.",
        },
      ].map(({ icon: Icon, title, text }) => (
        <div className="weight-tip" key={title}>
          <Icon size={18} />
          <div>
            <strong>{title}</strong>
            <p>{text}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
