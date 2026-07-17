// Parametric Infinite-Problem Generator for ASVAB AR
// Generates infinite unique problems from mathematical templates

import { ARQuestion, topicForQuestion } from './ar-question-bank';
import type { ARTopicSlug } from './lesson-types';

// Random utilities
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min: number, max: number, decimals: number) => 
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
const randChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Common names and objects for word problems
const NAMES = ['John', 'Sarah', 'Mike', 'Emily', 'David', 'Lisa', 'James', 'Anna', 'Robert', 'Maria'];
const ITEMS = ['shirts', 'books', 'laptops', 'phones', 'chairs', 'lamps', 'watches', 'shoes', 'tablets', 'cameras'];
const VEHICLES = ['car', 'truck', 'boat', 'train', 'bicycle', 'motorcycle'];
const TASKS = ['paperwork', 'meetings', 'phone calls', 'emails', 'reports', 'training'];
const LIQUIDS = ['oil', 'paint', 'fuel', 'water', 'coolant'];
const BUSINESSES = ['store', 'shop', 'company', 'warehouse', 'factory'];

// Distractor generation strategies
const makeDistractors = (correct: number, type: 'percent' | 'whole' | 'fraction' | 'time' | 'money'): number[] => {
  const distractors: number[] = [];
  
  switch (type) {
    case 'percent':
      // Common percent errors: divide by new instead of old, forget to multiply by 100
      distractors.push(correct * 0.1); // Forgot to multiply by 100
      distractors.push(correct * 2); // Doubled by mistake
      distractors.push(100 - correct); // Complementary percent
      break;
    
    case 'whole':
      // Common whole number errors: off by factor of 10, arithmetic slips
      distractors.push(correct * 10);
      distractors.push(correct / 10);
      distractors.push(correct + randInt(1, 5));
      distractors.push(correct - randInt(1, 5));
      break;
    
    case 'fraction':
      // Fraction errors: inverted, wrong operation, forgot to simplify
      if (correct !== 0) distractors.push(1 / correct);
      distractors.push(correct * 2);
      distractors.push(correct / 2);
      distractors.push(correct + 0.25);
      break;
    
    case 'time':
      // Time errors: wrong units, forgot conversion
      distractors.push(correct * 60); // Confused hours/minutes
      distractors.push(correct / 60);
      distractors.push(correct + 0.5);
      distractors.push(correct - 0.5);
      break;
    
    case 'money':
      // Money errors: decimal point, rounding
      distractors.push(correct * 10);
      distractors.push(correct / 10);
      distractors.push(Math.round(correct));
      distractors.push(correct * 1.1);
      break;
  }
  
  // Filter out duplicates and the correct answer
  const unique = [...new Set(distractors.filter(d => Math.abs(d - correct) > 0.001))];
  
  // Ensure we have exactly 3 distractors
  while (unique.length < 3) {
    const variation = correct * (0.5 + Math.random());
    if (Math.abs(variation - correct) > 0.001) {
      unique.push(variation);
    }
  }
  
  return unique.slice(0, 3);
};

// Format number for display
const fmt = (n: number, type: 'money' | 'percent' | 'whole' | 'decimal' = 'decimal'): string => {
  switch (type) {
    case 'money': return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    case 'percent': return `${n}%`;
    case 'whole': return Math.round(n).toString();
    default: return n % 1 === 0 ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '');
  }
};

// Parametric template type
export type ParametricTemplate = {
  id: string;
  missType: ARQuestion['missType'];
  subtype: string;
  generate: () => Omit<ARQuestion, 'id'>;
};

// TRANSLATION Templates
const translationTemplates: ParametricTemplate[] = [
  {
    id: 'pt1',
    missType: 'translation',
    subtype: 'part-of-fraction',
    generate: () => {
      const wholes = [
        { unit: 'dozen', value: 12 },
        { unit: 'gross', value: 144 },
        { unit: 'score', value: 20 },
        { unit: 'gallon', value: 4 }, // in quarts
        { unit: 'pound', value: 16 }, // in ounces
        { unit: 'yard', value: 3 }, // in feet
        { unit: 'hour', value: 60 }, // in minutes
      ];
      
      const whole = randChoice(wholes);
      const part = randInt(1, whole.value - 1);
      const fraction = part / whole.value;
      
      // Reduce fraction
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const g = gcd(part, whole.value);
      const num = part / g;
      const den = whole.value / g;
      
      const correct = `${num}/${den}`;
      const distractorFractions = [
        `${den}/${num}`, // Inverted
        `${part}/${whole.value}`, // Unreduced
        `${num}/${den + 1}`, // Close denominator
        `${num + 1}/${den}`, // Close numerator
      ].filter(f => f !== correct);
      
      const choices = [correct, ...randChoice(distractorFractions).split(',')].sort(() => Math.random() - 0.5);
      
      return {
        missType: 'translation',
        subtype: 'part-of-fraction',
        prompt: whole.unit === 'gallon' 
          ? `${part} quarts is what part of a gallon?`
          : whole.unit === 'pound'
          ? `${part} ounces is what part of a pound?`
          : whole.unit === 'yard'
          ? `${part} feet is what part of a yard?`
          : whole.unit === 'hour'
          ? `${part} minutes is what part of an hour?`
          : `${part} is what part of a ${whole.unit}?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(correct) as 0 | 1 | 2 | 3,
        explain: `${whole.value} ${whole.unit === 'gallon' ? 'quarts' : whole.unit === 'pound' ? 'ounces' : whole.unit === 'yard' ? 'feet' : whole.unit === 'hour' ? 'minutes' : 'items'} in a ${whole.unit}, so ${part}/${whole.value} = ${correct}.`
      };
    }
  },
  {
    id: 'pt2',
    missType: 'translation',
    subtype: 'fraction-of-number',
    generate: () => {
      const fractions = [
        { num: 1, den: 2 }, { num: 1, den: 3 }, { num: 1, den: 4 }, { num: 1, den: 5 },
        { num: 2, den: 3 }, { num: 3, den: 4 }, { num: 2, den: 5 }, { num: 3, den: 5 },
        { num: 3, den: 8 }, { num: 5, den: 8 }, { num: 7, den: 8 }
      ];
      
      const frac = randChoice(fractions);
      const multiples = [24, 36, 48, 60, 72, 96, 120, 144, 180, 240];
      const base = randChoice(multiples.filter(m => m % frac.den === 0));
      const result = (base * frac.num) / frac.den;
      
      const distractors = makeDistractors(result, 'whole');
      const choices = [result, ...distractors].map(n => fmt(n, 'whole')).sort(() => Math.random() - 0.5);
      
      return {
        missType: 'translation',
        subtype: 'fraction-of-number',
        prompt: `What is ${frac.num}/${frac.den} of ${base}?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(fmt(result, 'whole')) as 0 | 1 | 2 | 3,
        explain: `(${frac.num}/${frac.den}) × ${base} = ${frac.num} × ${base / frac.den} = ${result}.`
      };
    }
  },
  {
    id: 'pt3',
    missType: 'translation',
    subtype: 'rate-time-distance',
    generate: () => {
      const vehicle = randChoice(VEHICLES);
      const speeds = vehicle === 'bicycle' ? [10, 12, 15, 18, 20] :
                    vehicle === 'boat' ? [6, 8, 10, 12, 15] :
                    vehicle === 'train' ? [60, 75, 90, 100, 120] :
                    [30, 40, 45, 50, 55, 60, 65];
      
      const speed = randChoice(speeds);
      const times = [1.5, 2, 2.5, 3, 3.5, 4, 4.5];
      const time = randChoice(times);
      const distance = speed * time;
      
      const distractors = makeDistractors(distance, 'whole');
      const choices = [distance, ...distractors].map(n => `${fmt(n, 'whole')} miles`).sort(() => Math.random() - 0.5);
      
      return {
        missType: 'translation',
        subtype: 'rate-time-distance',
        prompt: `A ${vehicle} travels ${speed} mph. How far does it go in ${time} hours?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(`${fmt(distance, 'whole')} miles`) as 0 | 1 | 2 | 3,
        explain: `Distance = rate × time = ${speed} × ${time} = ${distance} miles.`
      };
    }
  },
  {
    id: 'pt4',
    missType: 'translation',
    subtype: 'work-rate',
    generate: () => {
      const worker = randChoice(['printer', 'machine', 'pump', 'assembly line', 'robot']);
      const units = worker === 'printer' ? 'pages' :
                   worker === 'pump' ? 'gallons' :
                   worker === 'machine' ? 'parts' :
                   'items';
      
      const rate = randInt(5, 15) * 4; // Divisible by 4 for clean math
      const timeUnit = randInt(2, 8);
      const totalUnits = rate * randInt(3, 10);
      const totalTime = (totalUnits / rate) * timeUnit;
      
      const distractors = makeDistractors(totalTime, 'whole');
      const choices = [totalTime, ...distractors].map(n => `${fmt(n, 'whole')} minutes`).sort(() => Math.random() - 0.5);
      
      return {
        missType: 'translation',
        subtype: 'work-rate',
        prompt: `A ${worker} processes ${rate} ${units} in ${timeUnit} minutes. How long to process ${totalUnits} ${units}?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(`${fmt(totalTime, 'whole')} minutes`) as 0 | 1 | 2 | 3,
        explain: `Rate = ${rate / timeUnit} ${units}/min. Time = ${totalUnits} ÷ ${rate / timeUnit} = ${totalTime} minutes.`
      };
    }
  }
];

// SETUP Templates (Percent problems)
const setupTemplates: ParametricTemplate[] = [
  {
    id: 'ps1',
    missType: 'setup',
    subtype: 'percent-increase',
    generate: () => {
      const item = randChoice(['price', 'rent', 'salary', 'stock value', 'membership fee']);
      const original = randInt(4, 20) * 10;
      const percentIncrease = randChoice([8, 10, 12, 15, 20, 25, 30]);
      const newValue = original * (1 + percentIncrease / 100);
      
      const distractors = [
        percentIncrease * 1.5, // Common error: wrong calculation
        percentIncrease / 2,
        (newValue - original) / newValue * 100, // Divided by new instead of original
      ].map(n => Math.round(n));
      
      const choices = [percentIncrease, ...distractors].map(n => `${n}%`).sort(() => Math.random() - 0.5);
      
      return {
        missType: 'setup',
        subtype: 'percent-increase',
        prompt: `A ${item} rose from ${fmt(original, 'money')} to ${fmt(newValue, 'money')}. What is the percent increase?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(`${percentIncrease}%`) as 0 | 1 | 2 | 3,
        explain: `Change = ${fmt(newValue - original, 'money')}. Divide by ORIGINAL: ${newValue - original}/${original} = ${percentIncrease / 100} = ${percentIncrease}%.`
      };
    }
  },
  {
    id: 'ps2',
    missType: 'setup',
    subtype: 'percent-discount',
    generate: () => {
      const item = randChoice(ITEMS);
      const original = randChoice([40, 50, 60, 75, 80, 100, 120, 150]);
      const discount = randChoice([10, 15, 20, 25, 30, 35, 40]);
      const salePrice = original * (1 - discount / 100);
      
      const distractors = [
        original - discount, // Subtracted percent as dollar amount
        original * (discount / 100), // Amount saved, not sale price
        original - (original * discount), // Forgot to divide by 100
      ];
      
      const choices = [salePrice, ...distractors].map(n => fmt(n, 'money')).sort(() => Math.random() - 0.5);
      
      return {
        missType: 'setup',
        subtype: 'percent-discount',
        prompt: `${item.charAt(0).toUpperCase() + item.slice(1)} originally ${fmt(original, 'money')}, marked down ${discount}%. Sale price?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(fmt(salePrice, 'money')) as 0 | 1 | 2 | 3,
        explain: `Keep ${100 - discount}%. ${original} × ${(100 - discount) / 100} = ${fmt(salePrice, 'money')}.`
      };
    }
  },
  {
    id: 'ps3',
    missType: 'setup',
    subtype: 'percent-find-whole',
    generate: () => {
      const whole = randChoice([60, 80, 100, 120, 150, 200, 240, 300]);
      const percent = randChoice([12, 15, 20, 25, 30, 40]);
      const part = whole * (percent / 100);
      
      const distractors = [
        part * percent / 100, // Applied percent twice
        part + percent, // Added percent as value
        100 * part / percent, // Inverted calculation (actually correct!)
        part / (percent / 100), // This is correct, need different distractor
      ];
      
      // Fix distractors
      distractors[3] = whole * 2; // Double the correct answer
      
      const choices = [whole, ...distractors.slice(0, 3)].map(n => fmt(n, 'whole')).sort(() => Math.random() - 0.5);
      
      return {
        missType: 'setup',
        subtype: 'percent-find-whole',
        prompt: `${part} is ${percent}% of what number?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(fmt(whole, 'whole')) as 0 | 1 | 2 | 3,
        explain: `${part} ÷ ${percent / 100} = ${whole}. When you know part + rate → find whole = part ÷ rate.`
      };
    }
  },
  {
    id: 'ps4',
    missType: 'setup',
    subtype: 'profit-per-item',
    generate: () => {
      const item = randChoice(ITEMS);
      const numItems = randChoice([8, 10, 12, 15, 20, 25]);
      const profitPerItem = randChoice([5, 8, 10, 12, 15, 20]);
      const totalProfit = numItems * profitPerItem;
      const cost = randInt(10, 30) * numItems;
      const revenue = cost + totalProfit;
      
      const distractors = [
        numItems + 2,
        numItems - 2,
        totalProfit / (profitPerItem * 2), // Wrong profit per item
        revenue / profitPerItem, // Used revenue instead of profit
      ].filter(n => n > 0);
      
      const choices = [numItems, ...distractors.slice(0, 3)].map(n => fmt(n, 'whole')).sort(() => Math.random() - 0.5);
      
      return {
        missType: 'setup',
        subtype: 'profit-per-item',
        prompt: `A vendor buys ${item} for ${fmt(cost, 'money')} total, sells them for ${fmt(revenue, 'money')} making ${fmt(profitPerItem, 'money')} profit per item. How many ${item}?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(fmt(numItems, 'whole')) as 0 | 1 | 2 | 3,
        explain: `Total profit = ${fmt(revenue, 'money')} − ${fmt(cost, 'money')} = ${fmt(totalProfit, 'money')}. Number of ${item} = ${totalProfit} ÷ ${profitPerItem} = ${numItems}.`
      };
    }
  }
];

// ARITHMETIC Templates
const arithmeticTemplates: ParametricTemplate[] = [
  {
    id: 'pa1',
    missType: 'arithmetic',
    subtype: 'division',
    generate: () => {
      const contexts = [
        { item: 'car', unit: 'mpg', action: 'mile trip' },
        { item: 'pump', unit: 'gal/min', action: 'gallons' },
        { item: 'machine', unit: 'parts/hr', action: 'parts' },
      ];
      
      const ctx = randChoice(contexts);
      const rate = randChoice([24, 28, 32, 36, 40, 45]) ;
      const total = rate * randInt(5, 12);
      const result = total / rate;
      
      const distractors = [
        result + 1,
        result - 1,
        result + 0.5,
        Math.floor(total / (rate + 4)), // Used wrong rate
      ];
      
      const unit = ctx.unit === 'mpg' ? 'gallons' : 
                  ctx.unit === 'gal/min' ? 'minutes' : 'hours';
      const choices = [result, ...distractors.slice(0, 3)].map(n => fmt(n, 'whole')).sort(() => Math.random() - 0.5);
      
      return {
        missType: 'arithmetic',
        subtype: 'division',
        prompt: `A ${ctx.item} ${ctx.unit === 'mpg' ? `gets ${rate} ${ctx.unit}` : `processes at ${rate} ${ctx.unit}`}. How many ${unit} for ${total} ${ctx.action}?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(fmt(result, 'whole')) as 0 | 1 | 2 | 3,
        explain: `${total} ÷ ${rate} = ${result} ${unit}.`
      };
    }
  },
  {
    id: 'pa2',
    missType: 'arithmetic',
    subtype: 'decimal-multiply',
    generate: () => {
      const contexts = [
        { item: 'insurance', rate: 'per $1,000 coverage' },
        { item: 'tax', rate: 'per $100 value' },
        { item: 'shipping', rate: 'per pound' },
      ];
      
      const ctx = randChoice(contexts);
      const rateAmount = randFloat(0.5, 5, 2) * 10;
      const multiplier = randChoice([5, 7, 8, 12, 15]);
      const result = rateAmount * multiplier;
      
      const distractors = makeDistractors(result, 'money');
      const choices = [result, ...distractors].map(n => fmt(n, 'money')).sort(() => Math.random() - 0.5);
      
      const totalAmount = ctx.item === 'insurance' ? `${fmt(multiplier * 1000, 'money')} coverage` :
                         ctx.item === 'tax' ? `${fmt(multiplier * 100, 'money')} property` :
                         `${multiplier} pounds`;
      
      return {
        missType: 'arithmetic',
        subtype: 'decimal-multiply',
        prompt: `${ctx.item.charAt(0).toUpperCase() + ctx.item.slice(1)} costs ${fmt(rateAmount, 'money')} ${ctx.rate}. Annual cost for ${totalAmount}?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(fmt(result, 'money')) as 0 | 1 | 2 | 3,
        explain: `${fmt(rateAmount, 'money')} × ${multiplier} = ${fmt(result, 'money')}.`
      };
    }
  }
];

// UNITS Templates
const unitsTemplates: ParametricTemplate[] = [
  {
    id: 'pu1',
    missType: 'units',
    subtype: 'weight-conversion',
    generate: () => {
      const conversions = [
        { from: 'tons', to: 'pounds', factor: 2000 },
        { from: 'pounds', to: 'ounces', factor: 16 },
        { from: 'kilograms', to: 'grams', factor: 1000 },
      ];
      
      const conv = randChoice(conversions);
      const fromValue = conv.from === 'tons' ? randFloat(1.5, 4.5, 1) :
                       conv.from === 'pounds' ? randInt(3, 8) :
                       randFloat(2, 6, 1);
      const toValue = fromValue * conv.factor;
      
      const distractors = [
        toValue / 10,
        toValue / conv.factor, // Divided instead of multiplied
        toValue * 10,
        fromValue, // Forgot to convert
      ];
      
      const choices = [toValue, ...distractors.slice(0, 3)].map(n => fmt(n, 'whole')).sort(() => Math.random() - 0.5);
      
      return {
        missType: 'units',
        subtype: 'weight-conversion',
        prompt: `Convert ${fromValue} ${conv.from} to ${conv.to}.`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(fmt(toValue, 'whole')) as 0 | 1 | 2 | 3,
        explain: `1 ${conv.from.slice(0, -1)} = ${conv.factor} ${conv.to}. ${fromValue} × ${conv.factor} = ${toValue} ${conv.to}.`
      };
    }
  },
  {
    id: 'pu2',
    missType: 'units',
    subtype: 'time-conversion',
    generate: () => {
      const hours = randChoice([2.25, 2.5, 2.75, 3.25, 3.5, 3.75, 4.25, 4.5]);
      const minutes = hours * 60;
      
      const distractors = [
        Math.floor(hours) * 60 + (hours % 1) * 100, // Treated decimal as minutes
        hours * 100, // Thought 1 hour = 100 minutes
        Math.floor(minutes / 10) * 10, // Rounded incorrectly
        hours, // Forgot to convert
      ];
      
      const choices = [minutes, ...distractors.slice(0, 3)].map(n => fmt(n, 'whole')).sort(() => Math.random() - 0.5);
      
      return {
        missType: 'units',
        subtype: 'time-conversion',
        prompt: `How many minutes are in ${hours} hours?`,
        choices: choices as [string, string, string, string],
        correct: choices.indexOf(fmt(minutes, 'whole')) as 0 | 1 | 2 | 3,
        explain: `${hours} × 60 = ${minutes} minutes. Remember: 0.5 hours = 30 min, 0.25 hours = 15 min.`
      };
    }
  }
];

// Master template collection
export const PARAMETRIC_TEMPLATES: ParametricTemplate[] = [
  ...translationTemplates,
  ...setupTemplates,
  ...arithmeticTemplates,
  ...unitsTemplates,
];

// Generate a mixed set of questions filtered by missType OR topic.
export function generateQuestionSet(
  filter: { missType?: ARQuestion['missType'] } | { topic: ARTopicSlug } = {},
  count: number = 5
): ARQuestion[] {
  let templates: ParametricTemplate[];
  if ('topic' in filter && filter.topic) {
    templates = PARAMETRIC_TEMPLATES.filter(t => topicForQuestion({ subtype: t.subtype }) === filter.topic);
  } else if ('missType' in filter && filter.missType) {
    templates = PARAMETRIC_TEMPLATES.filter(t => t.missType === filter.missType);
  } else {
    templates = PARAMETRIC_TEMPLATES;
  }

  // Fallback if no templates exist for this filter — use the whole pool so
  // drills don't stall on an under-covered topic.
  if (templates.length === 0) templates = PARAMETRIC_TEMPLATES;

  const questions: ARQuestion[] = [];
  const usedTemplates = new Set<string>();

  for (let i = 0; i < count; i++) {
    const availableTemplates = templates.filter(t => !usedTemplates.has(t.id));
    const templatePool = availableTemplates.length > 0 ? availableTemplates : templates;

    const template = randChoice(templatePool);
    usedTemplates.add(template.id);

    const generated = template.generate();
    questions.push({
      id: `gen_${Date.now()}_${i}`,
      ...generated
    });
  }

  return questions;
}