// Save/load the whole batch as a JSON file — a portable backup that survives
// browser-data clears and moving between machines (no database for a one-off wedding).

export function saveProjectFile(order, guests) {
  const project = { app: 'mishphmcharacter', version: 2, savedAt: new Date().toISOString(), order, guests }
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `mishph-project_${stamp}_${guests.length}guests.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function readProjectFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!data || !Array.isArray(data.guests) || !data.guests.length) {
          return reject(new Error('Not a valid project file (no guests found).'))
        }
        resolve({ order: data.order, guests: data.guests })
      } catch {
        reject(new Error('Could not read file — is it a mishph project JSON?'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.readAsText(file)
  })
}
