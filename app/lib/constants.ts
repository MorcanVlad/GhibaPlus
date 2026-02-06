// app/lib/constants.ts

export const INTEREST_CATEGORIES = {
    "Sport & Mișcare": [
        "Fotbal", "Baschet", "Volei", "Rugby Tag", "Badminton"
    ],
    "Cluburi & Educație": [
        "Club de Carte", "Debate", "GhibaByte", "Informatică"
    ],
    "Evenimente & Social": [
        "Balul Bobocilor", "Excursii/Tabere", "Voluntariat", "Consiliul Elevilor"
    ]
};

// NOU: Lista Claselor
export const SCHOOL_CLASSES = [
    "9 A", "9 B", "9 C", "9 D", "9 E",
    "10 A", "10 B", "10 C", "10 D", "10 E",
    "11 A", "11 B", "11 C", "11 D", "11 E",
    "12 A", "12 B", "12 C", "12 D", "12 E"
];

// NOU: Tipuri de Evenimente Calendar
export const CALENDAR_TYPES = {
    "vacation": { label: "Vacanță", color: "bg-green-500" },
    "exam": { label: "Examene", color: "bg-red-500" },
    "special": { label: "Săptămâna Altfel / Verde", color: "bg-purple-500" },
    "holiday": { label: "Zi Liberă Națională", color: "bg-blue-500" }
};