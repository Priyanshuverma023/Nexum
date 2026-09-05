import * as chrono from 'chrono-node';

const result = chrono.parseDate('tomorrow at 3pm', new Date());
console.log('Parsed:', result);