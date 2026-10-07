export function isValidISODate(value) {
    if (typeof value !== 'string') return false
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    if (value.startsWith('0000-')) return false

    const date = new Date(`${value}T00:00:00.000Z`)

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    )
}