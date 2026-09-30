import Link from "next/link";

export function Header () {
    return (
        <header className="border-b">
            <div className="max-w-2xl mx-auto px-8 py-4 flex items-center justify-between">
                <Link href="/" className="text-sm font-medium tracking-tight">
                    BRÚJULA.ED
                </Link>
            </div>
        </header>
    );
}