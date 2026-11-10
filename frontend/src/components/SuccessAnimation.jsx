import { motion } from "framer-motion";

export default function SuccessAnimation() {
  return (
    <div className="relative mx-auto h-28 w-28">
      <motion.div
        className="absolute inset-0 rounded-full bg-paddy-100"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.6 }}
      />
      <motion.div
        className="absolute inset-0 rounded-full border-4 border-paddy-300"
        initial={{ scale: 1, opacity: 0.8 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ delay: 0.4, duration: 1.2, repeat: 2 }}
      />
      <svg viewBox="0 0 52 52" className="absolute inset-0 h-full w-full p-6">
        <motion.path
          d="M14 27 l8 8 l16 -18"
          fill="none"
          stroke="#257b49"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        />
      </svg>
    </div>
  );
}
