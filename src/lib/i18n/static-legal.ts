import {
  LEGAL_BETA_OPERATOR_PUBLIC_NOTICE,
  LEGAL_BETA_OPERATOR_PUBLIC_NOTICE_EN,
} from "@/content/legal/beta-notice"

/** Treści prawne oddzielone od głównego słownika ze względu na rozmiar. */

export const plTermsPage = {
  title: "Regulamin",
  lead: "Zasady korzystania z aplikacji WizytaOK.",
  draftNotice:
    "To jest robocza wersja regulaminu. Przed publicznym uruchomieniem aplikacji skonsultuj treść z prawnikiem lub doradcą.",
  operatorLine: LEGAL_BETA_OPERATOR_PUBLIC_NOTICE,
  contactLine: LEGAL_BETA_OPERATOR_PUBLIC_NOTICE,
  sec1Title: "1. Postanowienia ogólne",
  sec1Body:
    "Niniejszy regulamin określa ogólne zasady korzystania z aplikacji WizytaOK przez osoby prowadzące działalność lub zarządzające wizytami.",
  sec2Title: "2. Zakres działania aplikacji",
  sec2Body:
    "WizytaOK służy do planowania wizyt, udostępniania publicznej strony rezerwacji, zarządzania dostępnością oraz prostego kontaktu z klientami. Rzeczywisty zakres funkcji zależy od wersji aplikacji.",
  sec3Title: "3. Konto użytkownika",
  sec3Body:
    "Założenie konta wymaga podania danych uwierzytelniających i zachowania ich w poufności. Odpowiadasz za aktywność wykonaną po zalogowaniu.",
  sec4Title: "4. Publiczna strona rezerwacji",
  sec4Body:
    "Publiczna strona umożliwia klientom rezerwację w granicach dostępnych usług i terminów. Nie należy jej udostępniać, dopóki nie upewnisz się, że dane operatora i ustawienia są kompletne.",
  sec5Title: "5. Rezerwacje i zmiany terminów",
  sec5Body:
    "Rezerwacje oraz prośby o zmianę terminu lub usługi są rejestrowane w systemie i powinny być obsługiwane zgodnie z polityką Twojej firmy. Techniczne statusy informują o stanie każdej wizyty.",
  sec6Title: "6. Usługi, dostępność i osoby wykonujące usługi",
  sec6Body:
    "Prawidłowe skonfigurowanie usług, godzin pracy, wyjątków oraz przypisań osób zapewnia lepszy kalendarz dla klientów i mniejsze ryzyko konfliktów terminów.",
  sec7Title: "7. Wiadomości SMS i e-mail",
  sec7Body:
    "Funkcje wiadomości mogą mieć postać symulacji albo faktycznej integracji z operatorem. Do momentu jej skonfigurowania przyjmij, że dostarczenie wiadomości nie jest gwarantowane.",
  sec8Title: "8. Depozyty i płatności (jeżeli zostaną włączone)",
  sec8Body:
    "Jeśli funkcje płatności lub depozytów zostaną włączone, szczegóły pobrania oraz zwrotów będą opisane w ustawieniach lub w osobnym komunikacie operatora lub dostawcy płatności.",
  sec9Title: "9. Dane osobowe",
  sec9Body:
    "Dane osobowe przetwarzane w ramach aplikacji muszą mieć pokrycie w obowiązujących przepisach oraz dokumentacji operatora lub administratora po stronie usługodawcy.",
  sec10Title: "10. Odpowiedzialność",
  sec10Body:
    "Narzędzie dostarczasz lub używasz na własną odpowiedzialność biznesową. Operator nie przyjmuje odpowiedzialności za utracone przychody, opóźnienia komunikacji ani błędy konfiguracyjne po stronie użytkownika.",
  sec11Title: "11. Reklamacje i kontakt",
  sec11Body:
    "Jeśli chcesz zgłosić problem techniczny, skorzystaj z sekcji kontaktu do developera lub wiadomości przekazanej przez operatora. Reklamacje handlowe adresuj do podmiotu wskazanego przez operatora.",
  sec12Title: "12. Zmiany regulaminu",
  sec12Body:
    "Regulamin może zostać zmieniony przez operatora. Nowa treść jest publikowana w aplikacji i obowiązuje według wskazanego przez operatora czasu lub daty udostępnienia.",
} as const

export const enTermsPage = {
  title: "Terms",
  lead: "Rules for using the WizytaOK application.",
  draftNotice:
    "This is a draft version of the terms. Before launching the application publicly, consult it with a lawyer or advisor.",
  operatorLine: LEGAL_BETA_OPERATOR_PUBLIC_NOTICE_EN,
  contactLine: LEGAL_BETA_OPERATOR_PUBLIC_NOTICE_EN,
  sec1Title: "1. General provisions",
  sec1Body:
    "These terms outline how you may use WizytaOK when managing services, appointments or related workflows.",
  sec2Title: "2. Scope of the application",
  sec2Body:
    "WizytaOK supports scheduling visits, exposing a booking page and maintaining availability calendars. Functional scope may evolve with releases.",
  sec3Title: "3. User account",
  sec3Body:
    "Account creation requires credentials that you keep secret. Activity performed after sign-in remains your responsibility.",
  sec4Title: "4. Public booking page",
  sec4Body:
    "The booking page lets clients reserve services within configured limits. Do not circulate it externally until operating data looks complete.",
  sec5Title: "5. Appointments and rescheduling",
  sec5Body:
    "Booking activity and reschedule requests generate statuses you should reconcile with real-world policies for your studio or clinic.",
  sec6Title: "6. Services, availability and staff",
  sec6Body:
    "Accurate configuration of offerings, calendars, overrides and staffing reduces double-bookings on the consumer-facing timetable.",
  sec7Title: "7. SMS or email notices",
  sec7Body:
    "Messaging integrations may simulate delivery early on. Assume delivery may fail unless a telecom or ESP gateway is authenticated.",
  sec8Title: "8. Deposits or payments when enabled",
  sec8Body:
    "If Stripe or deposits switch on, contractual terms from the configured operator or PSP govern capture, reconciliation and refunds.",
  sec9Title: "9. Personal data",
  sec9Body:
    "Whenever you introduce personal information, comply with GDPR and complementary policies published by whoever acts as processor or controller.",
  sec10Title: "10. Liability",
  sec10Body:
    "The software is supplied as a productivity aide. Operators do not indemnify lost revenue stemming from outages, outages of SMS vendors or staffing mistakes.",
  sec11Title: "11. Complaints & contact paths",
  sec11Body:
    "Technical difficulties can be surfaced through Developer contact placeholders. Formal complaints should mirror whatever channel operator defines.",
  sec12Title: "12. Terms updates",
  sec12Body:
    "We may revise this document inside the UI. Revised text becomes enforceable upon the communicated effective date.",
} as const

export const plDeveloperPage = {
  title: "Kontakt do developera",
  lead: "Dane kontaktowe w sprawie technicznej aplikacji (uzupełnij przed produkcją).",
  techNote: "Kontakt techniczny w sprawach działania aplikacji.",
  nameLabel: "Nazwa",
  namePlaceholder: "Cronova",
  emailLabel: "E-mail",
  emailPlaceholder: "kontakt@cronova.com.pl",
  websiteLabel: "Strona WWW (opcjonalnie)",
  websitePlaceholder: "www.cronova.com.pl",
  supportChatTitle: "Czat z obsługą",
  supportChatHint: "Jeśli potrzebujesz szybkiej pomocy, przejdź do czatu wsparcia.",
  supportChatCta: "Przejdź do czatu z obsługą",
  backHome: "Strona główna",
} as const

export const enDeveloperPage = {
  title: "Developer contact",
  lead: "Fill these placeholders before handing the build to stakeholders.",
  techNote: "Technical contact for application issues.",
  nameLabel: "Developer name",
  namePlaceholder: "[add name]",
  emailLabel: "Email",
  emailPlaceholder: "[add developer email]",
  websiteLabel: "Website (optional)",
  websitePlaceholder: "[optional]",
  supportChatTitle: "Support chat",
  supportChatHint: "If you need quick help, open the support chat.",
  supportChatCta: "Open support chat",
  backHome: "Home",
} as const
