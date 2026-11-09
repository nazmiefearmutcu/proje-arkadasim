"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { registerAction } from "@/lib/auth/register-action";
import { registerAccountSchema } from "@/lib/auth/schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { AI_CONSENT_STATEMENT, AI_PROVIDER } from "@/config/legal";
import { AiConsentTextLink } from "@/components/legal/ai-consent-link";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { FormAlert } from "./form-alert";

const ACCOUNT_KEYS = ["firstName", "lastName", "email", "username", "password", "passwordRepeat"] as const;
type AccountKey = (typeof ACCOUNT_KEYS)[number];
type AccountValues = Record<AccountKey, string>;

const EMPTY_VALUES: AccountValues = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  password: "",
  passwordRepeat: "",
};

const STEPS = ["Hesap", "Onaylar", "Belge"] as const;

const CONSENT_ERROR_ID = "reg-consent-error";

function Stepper({ current }: { current: 1 | 2 }) {
  return (
    <ol aria-label="Kayıt adımları" className="grid grid-cols-3 gap-2">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const isCurrent = number === current;
        const isDone = number < current;
        return (
          <li
            key={label}
            aria-current={isCurrent ? "step" : undefined}
            className="flex min-w-0 flex-col items-start gap-1.5"
          >
            <span
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-chip t-meta font-[650]",
                isCurrent && "bg-pen text-pen-ink",
                isDone && "bg-pen-soft text-pen",
                !isCurrent && !isDone && "bg-surface-2 text-ink-3",
              )}
            >
              {number}
            </span>
            <span className={cn("t-meta truncate", isCurrent ? "text-ink" : "text-ink-3")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Explanation({ children }: { children: ReactNode }) {
  return <li className="t-meta text-ink-2">{children}</li>;
}

/**
 * Üç adımlı kayıt. Adım 1 ve 2 aynı formun istemci tarafı görünümleridir; adım 3 (belge) kayıt
 * sonrası `/dogrulama` sayfasıdır. Sunucu hataları ilgili adıma götürülür.
 */
export function RegisterForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    registerAction,
    null,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<AccountValues>(EMPTY_VALUES);
  const [consents, setConsents] = useState({ privacyNotice: false, terms: false, crossBorderAi: false });
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  // Yeni sunucu yanıtında eski hata bayrakları sıfırlanır; hesap alanında hata varsa adım 1'e dönülür.
  const [handled, setHandled] = useState<ActionResult | null>(null);
  if (state !== handled) {
    setHandled(state);
    setDismissed({});
    if (state && !state.ok && state.fieldErrors) {
      const hasAccountError = Object.keys(state.fieldErrors).some((key) =>
        (ACCOUNT_KEYS as readonly string[]).includes(key),
      );
      if (hasAccountError) setStep(1);
    }
  }

  const serverErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const generalError = state && !state.ok && !state.fieldErrors ? state.error : null;

  function errorFor(key: string): string | undefined {
    return clientErrors[key] ?? (dismissed[key] ? undefined : serverErrors[key]);
  }

  function setValue(key: AccountKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setClientErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDismissed((prev) => ({ ...prev, [key]: true }));
  }

  function setConsent(key: keyof typeof consents, checked: boolean) {
    setConsents((prev) => ({ ...prev, [key]: checked }));
    setClientErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDismissed((prev) => ({ ...prev, [key]: true }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 1) {
      const parsed = registerAccountSchema.safeParse(values);
      if (!parsed.success) {
        setClientErrors(zodFieldErrors(parsed.error));
        return;
      }
      setClientErrors({});
      setStep(2);
      return;
    }

    const missing: Record<string, string> = {};
    if (!consents.privacyNotice) missing.privacyNotice = "Aydınlatma metnini okuduğunu onaylaman gerekiyor.";
    if (!consents.terms) missing.terms = "Kullanım koşullarını kabul etmen gerekiyor.";
    if (Object.keys(missing).length > 0) {
      setClientErrors(missing);
      return;
    }

    const formData = new FormData();
    for (const key of ACCOUNT_KEYS) formData.set(key, values[key]);
    if (consents.privacyNotice) formData.set("privacyNotice", "on");
    if (consents.terms) formData.set("terms", "on");
    if (consents.crossBorderAi) formData.set("crossBorderAi", "on");
    startTransition(() => formAction(formData));
  }

  const consentError = errorFor("privacyNotice") ?? errorFor("terms");
  // Hata görünürken zorunlu kutular hata metnine bağlanır; ekran okuyucu kutuda hatayı da okur.
  const consentDescribedBy = consentError ? CONSENT_ERROR_ID : undefined;

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Stepper current={step} />

      {step === 1 ? (
        <div className="flex flex-col gap-5">
          {generalError ? <FormAlert tone="danger">{generalError}</FormAlert> : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="reg-first-name"
              label="Ad"
              hint="Belgendeki adla birebir aynı yaz; doğrulamada eşleştirilecek."
              error={errorFor("firstName")}
            >
              <Input
                name="firstName"
                autoComplete="given-name"
                value={values.firstName}
                onChange={(event) => setValue("firstName", event.target.value)}
              />
            </Field>
            <Field
              id="reg-last-name"
              label="Soyad"
              hint="Belgendeki adla birebir aynı yaz; doğrulamada eşleştirilecek."
              error={errorFor("lastName")}
            >
              <Input
                name="lastName"
                autoComplete="family-name"
                value={values.lastName}
                onChange={(event) => setValue("lastName", event.target.value)}
              />
            </Field>
          </div>

          <Field id="reg-email" label="E-posta" error={errorFor("email")}>
            <Input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={values.email}
              onChange={(event) => setValue("email", event.target.value)}
            />
          </Field>

          <Field
            id="reg-username"
            label="Kullanıcı adı"
            hint="3 ile 20 karakter; küçük harf, rakam, alt çizgi (_) ve nokta (.)."
            error={errorFor("username")}
          >
            <Input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={values.username}
              onChange={(event) => setValue("username", event.target.value)}
            />
          </Field>

          <Field
            id="reg-password"
            label="Şifre"
            hint="En az 10 karakter; bir harf ve bir rakam içermeli."
            error={errorFor("password")}
          >
            <Input
              type="password"
              name="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => setValue("password", event.target.value)}
            />
          </Field>

          <Field id="reg-password-repeat" label="Şifre tekrar" error={errorFor("passwordRepeat")}>
            <Input
              type="password"
              name="passwordRepeat"
              autoComplete="new-password"
              value={values.passwordRepeat}
              onChange={(event) => setValue("passwordRepeat", event.target.value)}
            />
          </Field>

          <Button type="submit" className="w-full">
            Onaylara geç
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="t-section text-ink">Aydınlatma ve onaylar</h2>
            <p className="t-body text-ink-2">Hesabını oluşturmadan önce şunları bilmelisin:</p>
            <ul className="flex list-disc flex-col gap-2 pl-5 t-body text-ink-2">
              <li>
                Ad, soyad, e-posta, kullanıcı adın ve belgenden çıkarılan eğitim bilgilerin işlenir.
              </li>
              <li>Belge dosyası hiçbir zaman saklanmaz; yalnızca bellekte, saniyeler içinde işlenir.</li>
              <li>Belge metni yurt dışına yalnızca maskelenmiş hâlde ve yalnızca açık rızanla gider.</li>
              <li>Haklarını ayarlar sayfasından ve KVKK başvurusuyla kullanabilirsin.</li>
            </ul>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <Link
                href="/kvkk/aydinlatma"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-11 items-center rounded-control t-label text-pen ${focusRing}`}
              >
                Aydınlatma metninin tamamı
              </Link>
              <Link
                href="/kullanim-kosullari"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-11 items-center rounded-control t-label text-pen ${focusRing}`}
              >
                Kullanım koşulları
              </Link>
            </div>
          </section>

          <div className="flex flex-col gap-1 border-t border-line pt-5">
            <Checkbox
              name="privacyNotice"
              required
              checked={consents.privacyNotice}
              onChange={(event) => setConsent("privacyNotice", event.target.checked)}
              aria-invalid={errorFor("privacyNotice") ? true : undefined}
              aria-describedby={consentDescribedBy}
              label="Aydınlatma metnini okudum."
            />
            <Checkbox
              name="terms"
              required
              checked={consents.terms}
              onChange={(event) => setConsent("terms", event.target.checked)}
              aria-invalid={errorFor("terms") ? true : undefined}
              aria-describedby={consentDescribedBy}
              label="Kullanım koşullarını kabul ediyorum."
            />
            {consentError ? (
              <p id={CONSENT_ERROR_ID} role="alert" className="t-meta text-danger">
                {consentError}
              </p>
            ) : null}
          </div>

          <section className="flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-4">
            <h3 className="t-label text-ink">İsteğe bağlı açık rıza</h3>
            <Checkbox
              name="crossBorderAi"
              checked={consents.crossBorderAi}
              onChange={(event) => setConsent("crossBorderAi", event.target.checked)}
              label={AI_CONSENT_STATEMENT}
            />
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <Explanation>
                Ne gider: yalnızca maskelenmiş metin. TC kimlik numaran, öğrenci numaran, doğum bilgilerin,
                adres ve iletişim bilgilerin metinden çıkarılır; adın ve soyadın [AD] ve [SOYAD] ile değişir.
              </Explanation>
              <Explanation>Neden: belgeyi saniyeler içinde değerlendirebilmek için.</Explanation>
              <Explanation>
                Risk: {AI_PROVIDER.country} için KVKK kapsamında yeterlilik kararı yoktur. Maskeleme riski azaltır
                ama ortadan kaldırmaz; gönderilen metin takma adlı veridir.
              </Explanation>
              <Explanation>
                İşaretlemezsen belgen yurt dışına çıkmaz; ekibimiz en geç 24 saat içinde inceler.
              </Explanation>
              <Explanation>
                Bu rıza isteğe bağlıdır, hizmet şartı değildir. Ayarlar sayfasındaki Gizlilik ve KVKK bölümünden
                istediğin zaman geri alabilirsin.
              </Explanation>
            </ul>
            <AiConsentTextLink />
          </section>

          {generalError ? <FormAlert tone="danger">{generalError}</FormAlert> : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={buttonClasses("secondary", "md", "w-full sm:w-auto")}
            >
              Geri
            </button>
            <Button type="submit" loading={pending} className="w-full sm:flex-1">
              Hesabı oluştur ve belgeye geç
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
