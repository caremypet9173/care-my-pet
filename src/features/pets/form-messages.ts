import type { Locale } from "@/i18n/types";
const pl = {
  title: "Poznajmy Twojego pupila", intro: "Zacznij od imienia i gatunku. Resztę możesz uzupełnić później w dowolnym momencie.",
  newProfile: "Nowy profil", addPhoto: "Dodaj zdjęcie", changePhoto: "Zmień zdjęcie", removePhoto: "Usuń", photoHint: "Opcjonalnie. JPG, PNG lub WebP, do 10 MB.",
  privatePhoto: "Zdjęcie jest widoczne dla opiekunów w Twoim gospodarstwie.", optional: "Opcjonalnie", required: "Wymagane",
  additional: "Dodatkowe informacje", additionalHint: "Numer mikroczipa, rasa, kastracja, ważne szczegóły", approximate: "Data jest przybliżona", dateHint: "Nie znasz dokładnej daty? Pozostaw pole puste.",
  breedHint: "Możesz wpisać np. kot europejski, mieszaniec lub rasę.", namePlaceholder: "Np. Luna, Borys lub Mruczek", breedPlaceholder: "Np. kot europejski krótkowłosy",
  create: "Utwórz kartotekę", requiredHint: "* Pola wymagane do utworzenia profilu.",
  summary: "Popraw zaznaczone pola przed utworzeniem kartoteki.", nameError: "Podaj imię pupila (do 80 znaków).", speciesError: "Wybierz kota lub psa.", fieldError: "Sprawdź poprawność tego pola.",
  photoError: "Wybierz poprawne zdjęcie JPG, PNG lub WebP do 10 MB (maks. 40 megapikseli).", uploadError: "Nie udało się przesłać zdjęcia. Dane formularza zostały zachowane. Spróbuj ponownie.",
  cropTitle: "Dopasuj zdjęcie", cropHint: "Przeciągnij zdjęcie lub użyj suwaków, aby precyzyjnie wykadrować pyszczek w okręgu profilowym.", zoom: "Skala powiększenia", horizontal: "Przesunięcie poziome", vertical: "Przesunięcie pionowe", rotate: "Obróć o 90°", reset: "Domyślnie", savePhoto: "Zapisz zdjęcie", loading: "Wczytywanie zdjęcia…", cropError: "Nie udało się przygotować zdjęcia. Spróbuj innego pliku.", cropPrivacy: "Oryginalny plik pozostaje na urządzeniu. Zapiszemy tylko przycięty awatar.",
  catHint: "Kot lub kotka", dogHint: "Pies lub suczka", approximateLabel: "data przybliżona",
};
const en: typeof pl = {
  title: "Let’s meet your pet", intro: "Start with their name and species. You can fill in the rest later.",
  newProfile: "New profile", addPhoto: "Add photo", changePhoto: "Change photo", removePhoto: "Remove", photoHint: "Optional. JPG, PNG or WebP, up to 10 MB.",
  privatePhoto: "The photo is visible to caregivers in your household.", optional: "Optional", required: "Required",
  additional: "Additional information", additionalHint: "Microchip, breed, neutering and important details", approximate: "Date is approximate", dateHint: "Not sure of the date? Leave it empty.",
  breedHint: "Enter a breed or mixed breed, if known.", namePlaceholder: "E.g. Luna, Buddy or Milo", breedPlaceholder: "E.g. European shorthair",
  create: "Create record", requiredHint: "* Required to create a profile.",
  summary: "Correct the highlighted fields before creating the record.", nameError: "Enter your pet’s name (up to 80 characters).", speciesError: "Choose a cat or dog.", fieldError: "Check this field.",
  photoError: "Choose a valid JPG, PNG or WebP up to 10 MB (maximum 40 megapixels).", uploadError: "Could not upload the photo. Your form data has been kept. Please try again.",
  cropTitle: "Adjust photo", cropHint: "Drag the photo or use the sliders to position your pet’s face inside the profile circle.", zoom: "Zoom", horizontal: "Horizontal position", vertical: "Vertical position", rotate: "Rotate 90°", reset: "Reset", savePhoto: "Save photo", loading: "Loading photo…", cropError: "Could not prepare the photo. Try a different file.", cropPrivacy: "The original stays on your device. Only the cropped avatar will be uploaded.",
  catHint: "Cat or kitten", dogHint: "Dog or puppy", approximateLabel: "approximate date",
};
export const petFormMessages: Record<Locale, typeof pl> = { pl, en };
