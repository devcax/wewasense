import { AnimatePresence, motion } from "framer-motion";
import { CheckCheck, ChevronLeft, Phone, Video } from "lucide-react";

function SmsScreen({ contactName, text, time }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex flex-col items-center border-b border-slate-200 bg-slate-50 pb-2 pt-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-300 text-sm font-semibold text-white">WS</div>
        <div className="mt-1 text-[11px] font-medium text-slate-700">WewaSense</div>
        <div className="text-[10px] text-slate-400">to {contactName}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 text-center text-[10px] text-slate-400">Text Message · {time}</div>
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-slate-200 px-3 py-2 text-[12px] leading-snug text-slate-900"
        >
          {text}
        </motion.div>
      </div>
    </div>
  );
}

function WhatsAppScreen({ contactName, text, time }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 bg-[#075e54] px-2 py-2 text-white">
        <ChevronLeft size={18} />
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25d366] text-[10px] font-bold">WS</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">WewaSense</div>
          <div className="truncate text-[10px] text-white/70">to {contactName}</div>
        </div>
        <Video size={15} />
        <Phone size={14} />
      </div>
      <div className="flex-1 overflow-y-auto bg-[#ece5dd] p-3">
        <div className="mx-auto mb-2 w-fit rounded-md bg-[#e1f3fb] px-2 py-0.5 text-[10px] text-slate-600">TODAY</div>
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#dcf8c6] px-2.5 py-1.5 text-[12px] leading-snug text-slate-900 shadow-sm"
        >
          {text}
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-slate-500">
            {time} <CheckCheck size={12} className="text-sky-500" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function PhoneMockup({ channel, contactName, text }) {
  const time = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="mx-auto w-[260px] rounded-[2.2rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl">
      <div className="relative h-[460px] overflow-hidden rounded-[1.5rem] bg-white">
        <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-900" />
        <div className="h-full pt-6">
          <AnimatePresence mode="wait">
            <motion.div key={channel} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {channel === "whatsapp" ? (
                <WhatsAppScreen contactName={contactName} text={text} time={time} />
              ) : (
                <SmsScreen contactName={contactName} text={text} time={time} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
