import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { LEGAL } from "@/config/legal";
import { PageHeader } from "@/components/ui/page-header";
import { focusRing } from "@/components/ui/styles";

export const metadata = { title: "Yardım" };

const FAQ: Array<{ question: string; answer: React.ReactNode }> = [
  {
    question: "Neden belge istiyoruz?",
    answer: (
      <p>
        Platformdaki herkesin Türkiye’de üniversite öğrencisi veya mezunu olduğundan emin olmak için. Proje paylaşmak,
        katılma başvurusu yapmak ve mesajlaşmak için belge doğrulaması gerekir.
      </p>
    ),
  },
  {
    question: "Hangi belgeleri kabul ediyorsunuz?",
    answer: (
      <div className="flex flex-col gap-2">
        <p>En hızlı sonuç için e-Devlet’ten alınmış Öğrenci Belgesi PDF’i ya da YÖK Mezun Belgesi PDF’i yükle.</p>
        <p>
          Fotoğraf olarak JPEG, PNG veya WebP biçiminde üniversite belgesi de kabul edilir. Dosya en fazla 10 MB
          olabilir. Metin içermeyen (taranmış) PDF’ler okunamaz; bu durumda belgenin fotoğrafını yükle.
        </p>
      </div>
    ),
  },
  {
    question: "Belgem saklanıyor mu?",
    answer: (
      <div className="flex flex-col gap-2">
        <p>
          Hayır. Belge dosyası diske ya da veritabanına yazılmaz; yalnızca işlem sırasında bellekte tutulur. Sonuç
          kaydında belgenin parmak izi (özeti) ve eğitim alanları bulunur.
        </p>
        <p>Maskelenmiş belge metni yalnızca manuel inceleme gerektiğinde, en fazla 30 gün saklanır.</p>
      </div>
    ),
  },
  {
    question: "Doğrulama ne kadar sürer?",
    answer: (
      <p>
        Çoğu belge saniyeler içinde sonuçlanır. Sonuç belirsizse ekibimiz manuel olarak inceler; hedeflenen süre en
        fazla 24 saattir.
      </p>
    ),
  },
  {
    question: "Belgem reddedildi, ne yapmalıyım?",
    answer: (
      <p>
        Ret gerekçesi doğrulama sayfasında yazar. Gerekçeye göre belgeni düzelt ya da daha net bir belge yükle. Deneme
        hakkın 24 saatte 5 ile sınırlıdır.
      </p>
    ),
  },
  {
    question: "Mesaj isteği nedir?",
    answer: (
      <p>
        Birbirinizi takip etmiyorsanız ve ortak bir projeniz yoksa ilk mesajın istek olarak gider. Karşı taraf kabul
        ederse sohbet başlar; reddederse sohbet kapanır.
      </p>
    ),
  },
  {
    question: "Hesabımı nasıl silerim?",
    answer: (
      <p>
        Ayarlar sayfasındaki Hesabı sil bölümünden şifreni ve kullanıcı adını yazarak silebilirsin. Silme kalıcıdır;
        profilin, projelerin ve mesajların silinir.
      </p>
    ),
  },
  {
    question: "KVKK başvurusu nasıl yapılır?",
    answer: (
      <div className="flex flex-col gap-2">
        <p>
          Haklarını kullanmak için {LEGAL.email} adresine yaz. Hangi haklarına sahip olduğunu ve başvuru süresini{" "}
          <Link href="/kvkk/aydinlatma" className={`text-pen underline rounded-control ${focusRing}`}>
            aydınlatma metninde
          </Link>{" "}
          bulabilirsin.
        </p>
      </div>
    ),
  },
];

export default function Page() {
  return (
    <>
      <PageHeader
        title="Yardım"
        description="Sık sorulan sorular. Aradığını bulamazsan KVKK başvuru adresinden bize yazabilirsin."
      />
      <div className="flex flex-col gap-3">
        {FAQ.map((item) => (
          <details key={item.question} className="group rounded-card border border-line bg-surface">
            <summary
              className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-4 py-3 t-label text-ink [&::-webkit-details-marker]:hidden ${focusRing}`}
            >
              <span>{item.question}</span>
              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="px-4 pb-4 t-body text-ink-2">{item.answer}</div>
          </details>
        ))}
      </div>
    </>
  );
}
