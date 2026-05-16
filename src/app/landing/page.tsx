import React from "react";
import { CalendarCheck, Bell, Users, MessageSquare, ShieldCheck, Clock, CheckCircle2, ArrowRight, Sparkles, CalendarDays, UserCheck, Send, HelpCircle } from "lucide-react";

import { marketingSignupHref } from "@/lib/marketing/signup-href";

export default function WizytaOKLandingPage() {
  const features = [
    {
      icon: CalendarCheck,
      title: "Publiczny link rezerwacji",
      text: "Klient sam wybiera usługę, termin i osobę przez prostą stronę rezerwacji.",
    },
    {
      icon: Bell,
      title: "Automatyczne przypomnienia",
      text: "System przypomina klientowi o wizycie 24h wcześniej i może wysłać drugie przypomnienie przed samą wizytą.",
    },
    {
      icon: UserCheck,
      title: "Potwierdzanie wizyt",
      text: "Klient jednym kliknięciem potwierdza, zmienia albo anuluje wizytę.",
    },
    {
      icon: Users,
      title: "Zespół i usługi",
      text: "Dodajesz osoby, przypisujesz im usługi i kontrolujesz dostęp do panelu.",
    },
    {
      icon: CalendarDays,
      title: "Dostępność i dni wolne",
      text: "Ustawiasz godziny pracy, święta, urlopy, wyjątki i specjalne godziny.",
    },
    {
      icon: MessageSquare,
      title: "Historia wysyłek",
      text: "Widzisz, które wiadomości zostały wysłane, zaplanowane, pominięte albo zakończone błędem.",
    },
  ];

  const audience = [
    "Salony beauty",
    "Kosmetyczki",
    "Stylistki paznokci",
    "Fizjoterapeuci",
    "Masażyści",
    "Trenerzy personalni",
    "Małe gabinety",
    "Usługi lokalne",
  ];

  const statuses = [
    "Zarezerwowana",
    "Do potwierdzenia",
    "Potwierdzona",
    "Prośba o zmianę",
    "Firma proponuje zmianę",
    "Anulowana",
    "Nieobecność klienta",
  ];

  const faqs = [
    {
      q: "Czy klient musi zakładać konto?",
      a: "Nie. Klient korzysta z linku rezerwacji albo linku do zarządzania wizytą.",
    },
    {
      q: "Czy mogę dodać wizytę ręcznie?",
      a: "Tak. Wizyty mogą pochodzić z rezerwacji online albo zostać dodane ręcznie w panelu.",
    },
    {
      q: "Czy system sam wysyła przypomnienia?",
      a: "Tak, po podłączeniu wysyłki e-mail/SMS system może wysyłać automatyczne przypomnienia zgodnie z ustawieniami.",
    },
    {
      q: "Czy mogę mieć kilka osób w zespole?",
      a: "Tak. Możesz dodać osoby wykonujące usługi, przypisać im konkretne usługi i ustawić role dostępu.",
    },
    {
      q: "Czy mogę ustawić dni wolne?",
      a: "Tak. W kalendarzu wyjątków ustawisz święta, urlopy, dni nieczynne i specjalne godziny pracy.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#06111f] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,197,0.22),transparent_35%),radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-teal-300/30 bg-teal-300/10 px-4 py-2 text-sm font-semibold text-teal-200">
              <Sparkles className="h-4 w-4" />
              System rezerwacji dla małych firm usługowych
            </div>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Mniej pustych terminów. Mniej ręcznego pisania do klientów.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              WizytaOK pomaga przyjmować rezerwacje online, automatycznie przypominać klientom o wizytach i szybciej reagować na zmiany terminów.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <a href={marketingSignupHref()} className="inline-flex items-center justify-center rounded-2xl bg-teal-400 px-6 py-4 text-base font-bold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-300">
                Testuj za darmo przez 14 dni
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a href="#funkcje" className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-base font-bold text-white transition hover:bg-white/10">
                Zobacz funkcje
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Karta wymagana. Skonfiguruj system i sprawdź, czy pasuje do Twojej firmy.
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Po trialu 149 zł / miesiąc. 100 SMS miesięcznie w pakiecie.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-4 shadow-2xl shadow-teal-950/40 backdrop-blur">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#0b1829] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-teal-200">Dzisiaj</p>
                  <h3 className="text-xl font-bold">Plan dnia</h3>
                </div>
                <span className="rounded-full bg-teal-400 px-3 py-1 text-xs font-bold text-slate-950">WizytaOK</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Potwierdzone", "8"],
                  ["Do potwierdzenia", "3"],
                  ["Wymaga reakcji", "1"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-2 text-3xl font-black">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ["09:00", "Anna Kowalska", "Konsultacja", "Potwierdzona"],
                  ["11:30", "Piotr Nowak", "Masaż", "Do potwierdzenia"],
                  ["15:00", "Karolina Jabłońska", "Pierwsza wizyta", "Rezerwacja online"],
                ].map(([time, name, service, status]) => (
                  <div key={`${time}-${name}`} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-teal-300">{time}</p>
                        <p className="mt-1 font-bold">{name}</p>
                        <p className="text-sm text-slate-400">{service}</p>
                      </div>
                      <span className="rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1 text-xs font-bold text-teal-200">{status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-4">
          {([
            [Clock, "Puste okienka", "Mniej niepotwierdzonych terminów w kalendarzu."],
            [Send, "Mniej ręcznej pracy", "System przypomina klientom automatycznie."],
            [ShieldCheck, "Większa kontrola", "Widzisz, co jest potwierdzone i co wymaga reakcji."],
            [HelpCircle, "Prostsza obsługa", "Jeden panel dla wizyt, usług, zespołu i wiadomości."],
          ] as Array<[typeof Clock, string, string]>).map(([Icon, title, text]) => (
            <div key={String(title)} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <Icon className="h-7 w-7 text-teal-300" />
              <h3 className="mt-4 text-lg font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-teal-300">Problem</p>
            <h2 className="mt-4 text-3xl font-black sm:text-4xl">Klienci rezerwują termin, a potem nie przychodzą?</h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Każda pusta wizyta to stracony czas i pieniądze. WizytaOK pomaga uporządkować rezerwacje, potwierdzenia i zmiany terminów bez chaosu w wiadomościach.
            </p>
          </div>
        </div>
      </section>

      <section id="funkcje" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-teal-300">Funkcje</p>
          <h2 className="mt-4 text-3xl font-black sm:text-4xl">Wszystko, czego potrzebujesz do prostego zarządzania wizytami</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 transition hover:border-teal-300/40 hover:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-300/10 text-teal-300">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-black">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <div className="rounded-[2rem] border border-teal-300/20 bg-teal-300/10 p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-teal-200">Dla kogo?</p>
              <h2 className="mt-4 text-3xl font-black">Dla firm, które pracują na terminach</h2>
              <p className="mt-4 text-slate-300">WizytaOK sprawdzi się tam, gdzie każda nieobecność klienta oznacza stratę czasu.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {audience.map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-100">{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-teal-300">Statusy</p>
            <h2 className="mt-4 text-3xl font-black">Każda wizyta ma jasny status</h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Status pokazuje, co dzieje się z wizytą. Źródło wizyty pokazuje, czy klient zarezerwował termin online, czy wizyta została dodana ręcznie.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {statuses.map((status) => (
              <span key={status} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-100">{status}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-950/50">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-teal-300">14 dni za darmo</p>
              <h2 className="mt-4 text-3xl font-black sm:text-4xl">Przetestuj WizytaOK przez 14 dni za darmo</h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Sprawdź, czy system pasuje do Twojej firmy. Skonfiguruj usługi, dostępność, zespół i publiczny link rezerwacji bez zobowiązań.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              {[
                "Bez zobowiązań na start",
                "Konfiguracja usług i dostępności",
                "Publiczna strona rezerwacji",
                "Panel wizyt i klientów",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 border-b border-white/10 py-3 last:border-0">
                  <CheckCircle2 className="h-5 w-5 text-teal-300" />
                  <span className="font-semibold text-slate-100">{item}</span>
                </div>
              ))}
              <a href={marketingSignupHref()} className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-teal-400 px-6 py-4 text-base font-bold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-300">
                Testuj za darmo przez 14 dni
              </a>
              <p className="mt-3 text-center text-sm text-slate-400">
                Wymagana karta. Nie pobieramy opłaty przez 14 dni. Po trialu 149 zł / miesiąc, 100 SMS miesięcznie w
                pakiecie.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-teal-300">FAQ</p>
          <h2 className="mt-4 text-3xl font-black">Najczęstsze pytania</h2>
        </div>
        <div className="mt-10 space-y-4">
          {faqs.map(({ q, a }) => (
            <details key={q} className="group rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <summary className="cursor-pointer list-none text-lg font-black text-white">
                <div className="flex items-center justify-between gap-4">
                  <span>{q}</span>
                  <span className="text-teal-300 transition group-open:rotate-45">+</span>
                </div>
              </summary>
              <p className="mt-4 leading-7 text-slate-300">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div className="rounded-[2rem] border border-teal-300/20 bg-[linear-gradient(135deg,rgba(45,212,191,0.18),rgba(15,23,42,0.4))] p-8 text-center lg:p-12">
          <h2 className="text-3xl font-black sm:text-4xl">Zacznij od prostego testu</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Ustaw usługi, dodaj dostępność i sprawdź, jak WizytaOK pomaga uporządkować rezerwacje.
          </p>
          <a href={marketingSignupHref()} className="mt-8 inline-flex items-center justify-center rounded-2xl bg-teal-400 px-6 py-4 text-base font-bold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-300">
            Testuj za darmo przez 14 dni
            <ArrowRight className="ml-2 h-5 w-5" />
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black text-white">WizytaOK</p>
            <p className="mt-1">System rezerwacji i potwierdzania wizyt dla małych firm usługowych.</p>
          </div>
          <div className="flex flex-wrap gap-5">
            <a href="/terms" className="hover:text-white">Regulamin</a>
            <a href="/privacy" className="hover:text-white">Polityka prywatności</a>
            <a href="/developer-contact" className="hover:text-white">Kontakt</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

