import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

const ar: Record<string, string> = {
  "Simple and flexible ride booking": "حجز رحلات بسيط ومرن",
  "You name the price": "أنت تحدد السعر",
  Passenger: "راكب",
  Driver: "سائق",
  "Request a ride, set your price": "اطلب رحلة وحدد سعرك",
  "Browse and offer on requests": "تصفح الطلبات وقدّم عروضك",
  Ride: "رحلة",
  Drive: "قيادة",
  Profile: "الملف الشخصي",
  "Log in": "تسجيل الدخول",
  "Log out": "تسجيل الخروج",
  "Sign up": "إنشاء حساب",
  "Create account": "إنشاء حساب",
  "Full name": "الاسم الكامل",
  Phone: "الهاتف",
  Email: "البريد الإلكتروني",
  Password: "كلمة المرور",
  "Car model": "طراز السيارة",
  "Plate number": "رقم اللوحة",
  "I am a": "أنا",
  "Request a Ride": "اطلب رحلة",
  "Request Ride": "اطلب الرحلة",
  "Pickup Location": "مكان الانطلاق",
  Destination: "الوجهة",
  Pickup: "الانطلاق",
  "Proposed Price (EGP)": "السعر المقترح (جنيه)",
  "Proposed Price": "السعر المقترح",
  "Current ride": "الرحلة الحالية",
  "Previous rides": "الرحلات السابقة",
  "No rides yet.": "لا توجد رحلات بعد.",
  Cancel: "إلغاء",
  "Complete Ride": "إنهاء الرحلة",
  "Driver offers": "عروض السائقين",
  "Waiting for drivers to offer…": "في انتظار عروض السائقين…",
  Choose: "اختر",
  "Your driver": "سائقك",
  "Your passenger": "راكبك",
  "Available Ride Requests": "طلبات الرحلات المتاحة",
  "No ride requests right now.": "لا توجد طلبات حالياً.",
  "Go online to see requests.": "كن متصلاً لرؤية الطلبات.",
  Online: "متصل",
  Offline: "غير متصل",
  Accept: "قبول",
  Reject: "رفض",
  Offer: "اعرض",
  "Your offer": "عرضك",
  "Offer sent — waiting for passenger": "تم إرسال العرض — بانتظار الراكب",
  Navigate: "التوجيه",
  "Sharing your live location": "تتم مشاركة موقعك المباشر",
  "Location permission denied — passengers can't see you.": "تم رفض إذن الموقع — لن يراك الركاب.",
  "Driver live location": "موقع السائق المباشر",
  Save: "حفظ",
  Saved: "تم الحفظ",
  "Loading…": "جارٍ التحميل…",
  "Something went wrong": "حدث خطأ ما",
  "This page is for passengers.": "هذه الصفحة مخصصة للركاب.",
  "This page is for drivers.": "هذه الصفحة مخصصة للسائقين.",
  "Tap the map to set": "اضغط على الخريطة للتحديد",
  "Check your email to confirm your account.": "تحقق من بريدك الإلكتروني لتأكيد حسابك.",
  "Waiting for Driver": "بانتظار سائق",
  "Driver Offers": "عروض السائقين",
  "Driver Accepted": "تم اختيار السائق",
  "Driver Arriving": "السائق في الطريق",
  "Driver Arrived": "وصل السائق",
  "Trip Started": "بدأت الرحلة",
  "Trip Completed": "اكتملت الرحلة",
  Cancelled: "ملغاة",
  "On my way": "أنا في الطريق",
  "I've arrived": "لقد وصلت",
  "Start trip": "ابدأ الرحلة",
  "Complete trip": "أنهِ الرحلة",
  "Already have an account?": "لديك حساب بالفعل؟",
  "New to A&S GO?": "جديد على A&S GO؟",
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (s: string) => string;
}

const I18n = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (s) => s });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("asgo.lang");
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = (l: Lang) => {
    localStorage.setItem("asgo.lang", l);
    setLangState(l);
  };
  const t = (s: string) => (lang === "ar" ? ar[s] ?? s : s);
  return <I18n.Provider value={{ lang, setLang, t }}>{children}</I18n.Provider>;
}

export const useT = () => useContext(I18n);
