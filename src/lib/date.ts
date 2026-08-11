export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
export const longDate = (date = new Date()) => new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(date)
