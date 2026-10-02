/**
 * Secteurs et activités proposés dans l'assistant de recherche.
 * `osm` = filtres OpenStreetMap équivalents (source gratuite de secours).
 */
export type Activity = { label: string; osm: string[] };
export type Sector = { id: string; label: string; icon: string; activities: Activity[] };

const a = (label: string, ...osm: string[]): Activity => ({ label, osm });

export const SECTORS: Sector[] = [
  {
    id: "btp",
    label: "BTP & Architecture",
    icon: "🏗️",
    activities: [
      a("Entreprise de construction", "office=construction_company", "craft=builder"),
      a("Cabinet d'architecture", "office=architect"),
      a("Bureau d'études", "office=engineer"),
      a("Quincaillerie", "shop=hardware", "shop=doityourself"),
      a("Matériaux de construction", "shop=trade", "shop=hardware"),
      a("Plombier", "craft=plumber"),
      a("Électricien", "craft=electrician"),
      a("Menuiserie", "craft=carpenter", "craft=joiner"),
    ],
  },
  {
    id: "immobilier",
    label: "Immobilier",
    icon: "🏠",
    activities: [
      a("Agence immobilière", "office=estate_agent"),
      a("Promoteur immobilier", "office=estate_agent", "office=company"),
      a("Notaire", "office=notary"),
      a("Géomètre", "office=surveyor"),
    ],
  },
  {
    id: "transport",
    label: "Transport & Logistique",
    icon: "🚚",
    activities: [
      a("Transitaire", "office=logistics", "office=company"),
      a("Transport de marchandises", "office=logistics"),
      a("Location de voitures", "amenity=car_rental"),
      a("Agence de voyage", "shop=travel_agency", "office=travel_agent"),
      a("Auto-école", "amenity=driving_school"),
    ],
  },
  {
    id: "sante",
    label: "Santé",
    icon: "🏥",
    activities: [
      a("Clinique", "amenity=clinic", "healthcare=clinic"),
      a("Pharmacie", "amenity=pharmacy"),
      a("Cabinet médical", "amenity=doctors", "healthcare=doctor"),
      a("Dentiste", "amenity=dentist"),
      a("Laboratoire d'analyses", "healthcare=laboratory"),
      a("Opticien", "shop=optician"),
    ],
  },
  {
    id: "hotellerie",
    label: "Hôtellerie & Restauration",
    icon: "🍽️",
    activities: [
      a("Hôtel", "tourism=hotel"),
      a("Résidence / Appart-hôtel", "tourism=apartment", "tourism=guest_house"),
      a("Restaurant", "amenity=restaurant"),
      a("Fast-food", "amenity=fast_food"),
      a("Café", "amenity=cafe"),
      a("Boulangerie / Pâtisserie", "shop=bakery", "shop=pastry"),
      a("Traiteur", "craft=caterer"),
    ],
  },
  {
    id: "juridique",
    label: "Juridique & Finance",
    icon: "⚖️",
    activities: [
      a("Cabinet d'avocats", "office=lawyer"),
      a("Expert-comptable", "office=accountant"),
      a("Banque", "amenity=bank"),
      a("Assurance", "office=insurance"),
      a("Microfinance", "office=financial", "amenity=bank"),
      a("Bureau de change", "amenity=bureau_de_change"),
    ],
  },
  {
    id: "tech",
    label: "Informatique & Télécom",
    icon: "💻",
    activities: [
      a("Société informatique", "office=it", "shop=computer"),
      a("Agence de communication", "office=advertising_agency"),
      a("Imprimerie", "shop=copyshop", "craft=printer"),
      a("Boutique de téléphones", "shop=mobile_phone"),
    ],
  },
  {
    id: "education",
    label: "Éducation & Formation",
    icon: "🎓",
    activities: [
      a("École privée", "amenity=school"),
      a("Université / Institut", "amenity=university", "amenity=college"),
      a("Centre de formation", "amenity=training", "office=educational_institution"),
      a("Crèche / Jardin d'enfants", "amenity=kindergarten", "amenity=childcare"),
    ],
  },
  {
    id: "commerce",
    label: "Commerce & Distribution",
    icon: "🛒",
    activities: [
      a("Supermarché", "shop=supermarket"),
      a("Grossiste", "shop=wholesale"),
      a("Boutique de vêtements", "shop=clothes"),
      a("Magasin d'électroménager", "shop=electronics", "shop=appliance"),
      a("Meubles", "shop=furniture"),
      a("Cosmétiques", "shop=cosmetics", "shop=beauty"),
    ],
  },
  {
    id: "services",
    label: "Services & Beauté",
    icon: "💈",
    activities: [
      a("Salon de coiffure", "shop=hairdresser"),
      a("Institut de beauté", "shop=beauty"),
      a("Salle de sport", "leisure=fitness_centre"),
      a("Garage automobile", "shop=car_repair"),
      a("Pressing", "shop=dry_cleaning", "shop=laundry"),
      a("Société de sécurité", "office=security"),
      a("Société de nettoyage", "office=company"),
      a("Événementiel", "office=event_management"),
    ],
  },
];

const ALL = new Map<string, Activity>();
for (const s of SECTORS) for (const act of s.activities) ALL.set(act.label.toLowerCase(), act);

/** Filtres OSM pour une activité (connue ou saisie librement). */
export function osmFiltersFor(keyword: string): string[] {
  return ALL.get(keyword.toLowerCase())?.osm ?? [];
}
