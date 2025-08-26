import Image from 'next/image';

function Logo() {
  return (
    <div className="relative">
      <Image
        src="/bqilogo.png"
        alt="Company Logo"
        width={120}
        height={40}
        priority
        className="object-contain dark:hidden"
      />
      <Image
        src="/bqilogo-light.png"
        alt="Company Logo - Dark Mode"
        width={120}
        height={40}
        priority
        className="object-contain hidden dark:block"
      />
    </div>
  )
}

export default Logo; 