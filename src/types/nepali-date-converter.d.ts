declare module "nepali-date-converter" {
  class NepaliDate {
    constructor();
    constructor(date: Date);
    constructor(dateString: string);
    constructor(year: number, month: number, day: number);

    getYear(): number;
    getMonth(): number;
    getDate(): number;
    getDay(): number;

    format(formatStr: string): string;

    toJsDate(): Date;

    static fromAD(date: Date): NepaliDate;
  }

  export default NepaliDate;
}
