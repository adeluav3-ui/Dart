'use client'

import 'leaflet/dist/leaflet.css'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isInsideCoverage } from '@/lib/coverage'
import type { CoverageArea, CoverageWaitlistEntry } from '@/types/database'

interface Props {
  initialAreas: CoverageArea[]
  initialWaitlist: CoverageWaitlistEntry[]
}

// Sagamu centre
const DEFAULT_LAT = 6.7073
const DEFAULT_LNG = 3.8858

export function CoverageClient({ initialAreas, initialWaitlist }: Props) {
  const [areas, setAreas] = useState<CoverageArea[]>(initialAreas)
  const [waitlist] = useState<CoverageWaitlistEntry[]>(initialWaitlist)
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [pendingPolygon, setPendingPolygon] = useState<{ type: 'Polygon'; coordinates: number[][][] } | null>(null)
  const [pendingLayer, setPendingLayer] = useState<any>(null)
  const [nameError, setNameError] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const mapRef = useRef<any>(null)
  const layersRef = useRef<Record<string, any>>({}) // areaId → Leaflet layer
  const waitlistLayerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const redrawWaitlistLayer = useCallback((map: any, L: any, show: boolean) => {
    if (waitlistLayerRef.current) {
      map.removeLayer(waitlistLayerRef.current)
      waitlistLayerRef.current = null
    }
    if (!show || waitlist.length === 0) return
    const group = L.layerGroup()
    for (const entry of waitlist) {
      if (entry.lat == null || entry.lng == null) continue
      L.circleMarker([entry.lat, entry.lng], {
        radius: 7,
        color: '#F26A1B',
        fillColor: '#F26A1B',
        fillOpacity: 0.7,
        weight: 2,
      }).bindTooltip(entry.email ?? 'No email', { permanent: false }).addTo(group)
    }
    group.addTo(map)
    waitlistLayerRef.current = group
  }, [waitlist])

  useEffect(() => {
    if (!containerRef.current) return
    let mounted = true

    async function initMap() {
      const L = (await import('leaflet')).default
      await import('@geoman-io/leaflet-geoman-free')
      await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css' as any)

      if (!mounted || !containerRef.current) return

      const map = L.map(containerRef.current, {
        center: [DEFAULT_LAT, DEFAULT_LNG],
        zoom: 14,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // Enable geoman drawing tools
      ;(map as any).pm.addControls({
        position: 'topleft',
        drawCircle: false,
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawText: false,
        editMode: true,
        dragMode: false,
        cutPolygon: false,
        removalMode: false,
      })

      // Draw existing active areas as green polygons
      for (const area of initialAreas) {
        if (!area.polygon || !area.polygon.coordinates?.length) continue
        const layer = L.geoJSON(area.polygon, {
          style: {
            color: area.is_active ? '#0B7A47' : '#5B6168',
            fillColor: area.is_active ? '#0B7A47' : '#9CA3AF',
            fillOpacity: 0.2,
            weight: 2,
          },
        }).bindTooltip(area.name, { permanent: true, direction: 'center', className: 'area-label' }).addTo(map)
        layersRef.current[area.id] = layer
      }

      // Listen for newly drawn polygons
      map.on('pm:create', (e: any) => {
        const { layer } = e
        const geojson = layer.toGeoJSON()
        const polygon = geojson.geometry as { type: 'Polygon'; coordinates: number[][][] }
        // Temporarily style it
        layer.setStyle({ color: '#0B7A47', fillColor: '#0B7A47', fillOpacity: 0.2, weight: 2 })
        setPendingPolygon(polygon)
        setPendingLayer(layer)
        setPendingName('')
        setNameError('')
      })

      mapRef.current = map
    }

    initMap()

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(({ default: L }) => {
      redrawWaitlistLayer(mapRef.current, L, showWaitlist)
    })
  }, [showWaitlist, redrawWaitlistLayer])

  async function saveNewArea() {
    if (!pendingPolygon || !pendingName.trim()) {
      setNameError('Enter a name for this area')
      return
    }
    setNameError('')
    setSavingId('new')
    const { data, error } = await supabase
      .from('coverage_areas')
      .insert({ name: pendingName.trim(), polygon: pendingPolygon, is_active: true })
      .select()
      .single()

    if (error || !data) {
      setNameError(error?.message ?? 'Save failed')
      setSavingId(null)
      return
    }

    const newArea = data as CoverageArea
    setAreas(prev => [...prev, newArea])
    if (pendingLayer && mapRef.current) {
      pendingLayer.bindTooltip(newArea.name, { permanent: true, direction: 'center', className: 'area-label' })
      layersRef.current[newArea.id] = pendingLayer
    }
    setPendingPolygon(null)
    setPendingLayer(null)
    setPendingName('')
    setSavingId(null)
  }

  function cancelNewArea() {
    if (pendingLayer && mapRef.current) {
      mapRef.current.removeLayer(pendingLayer)
    }
    setPendingPolygon(null)
    setPendingLayer(null)
    setPendingName('')
    setNameError('')
  }

  async function toggleActive(area: CoverageArea) {
    setSavingId(area.id)
    const newActive = !area.is_active
    await supabase.from('coverage_areas').update({ is_active: newActive, updated_at: new Date().toISOString() }).eq('id', area.id)
    setAreas(prev => prev.map(a => a.id === area.id ? { ...a, is_active: newActive } : a))
    // Update layer style
    const layer = layersRef.current[area.id]
    if (layer) {
      layer.setStyle({
        color: newActive ? '#0B7A47' : '#5B6168',
        fillColor: newActive ? '#0B7A47' : '#9CA3AF',
        fillOpacity: 0.2,
      })
    }
    setSavingId(null)
  }

  async function saveRename(areaId: string) {
    if (!editName.trim()) return
    setSavingId(areaId)
    await supabase.from('coverage_areas').update({ name: editName.trim(), updated_at: new Date().toISOString() }).eq('id', areaId)
    setAreas(prev => prev.map(a => a.id === areaId ? { ...a, name: editName.trim() } : a))
    const layer = layersRef.current[areaId]
    if (layer?.setTooltipContent) layer.setTooltipContent(editName.trim())
    setEditId(null)
    setEditName('')
    setSavingId(null)
  }

  function nearestAreaForWaitlistEntry(entry: CoverageWaitlistEntry): string {
    if (entry.lat == null || entry.lng == null) return '—'
    const inside = isInsideCoverage(entry.lat, entry.lng, areas)
    if (inside) return inside
    // Find nearest by name only (we don't have area centroids easily, so show "Outside all areas")
    return 'Outside all areas'
  }

  function downloadCSV() {
    const rows = [
      ['Email', 'Lat', 'Lng', 'Date', 'Coverage'],
      ...waitlist.map(e => [
        e.email ?? '',
        e.lat?.toString() ?? '',
        e.lng?.toString() ?? '',
        new Date(e.created_at).toLocaleString('en-NG'),
        nearestAreaForWaitlistEntry(e),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coverage-waitlist-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-canvas font-body text-ink pb-16">
      <header className="bg-white px-5 pt-6 pb-4 border-b border-line">
        <h1 className="font-heading font-extrabold text-xl">Coverage Areas</h1>
        <p className="text-sm text-ink-2 mt-1">Draw delivery coverage polygons. Only pinned spots inside an active area can order.</p>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Map */}
        <section className="bg-white rounded-2xl overflow-hidden" style={{ height: 420 }}>
          <div ref={containerRef} className="w-full h-full" />
        </section>

        {/* Pending new polygon — name it */}
        {pendingPolygon && (
          <section className="bg-white rounded-2xl p-4 flex flex-col gap-3 border-2 border-brand">
            <p className="text-sm font-bold text-ink">New area drawn — give it a name</p>
            <input
              type="text"
              placeholder="e.g. OOUTH Area"
              value={pendingName}
              onChange={e => setPendingName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveNewArea()}
              className="h-10 px-3 rounded-xl border border-line font-body text-sm text-ink"
            />
            {nameError && <p className="text-xs text-danger">{nameError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveNewArea}
                disabled={savingId === 'new'}
                className="h-9 px-5 rounded-xl bg-brand text-white font-semibold text-sm border-0 disabled:opacity-50"
              >
                {savingId === 'new' ? 'Saving…' : 'Save area'}
              </button>
              <button type="button" onClick={cancelNewArea}
                className="h-9 px-5 rounded-xl bg-surface text-ink font-semibold text-sm border-0">
                Discard
              </button>
            </div>
          </section>
        )}

        {/* Areas list */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <h2 className="font-bold text-base">Defined areas ({areas.length})</h2>
          {areas.length === 0 && (
            <p className="text-sm text-ink-2">No areas yet. Draw a polygon on the map to create one.</p>
          )}
          <div className="flex flex-col gap-2">
            {areas.map(area => (
              <div key={area.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface">
                <div className={`w-3 h-3 rounded-full flex-none ${area.is_active ? 'bg-brand' : 'bg-line'}`} />
                <div className="flex-1 min-w-0">
                  {editId === area.id ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveRename(area.id); if (e.key === 'Escape') setEditId(null) }}
                        className="h-8 px-2 rounded-lg border border-line text-sm flex-1"
                        autoFocus
                      />
                      <button onClick={() => saveRename(area.id)} disabled={savingId === area.id}
                        className="text-xs font-semibold text-brand bg-transparent border-0 cursor-pointer disabled:opacity-50">
                        {savingId === area.id ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="text-xs text-ink-2 bg-transparent border-0 cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{area.name}</span>
                      {!area.polygon && <span className="text-[11px] text-ink-2 italic">(no polygon)</span>}
                      <button
                        onClick={() => { setEditId(area.id); setEditName(area.name) }}
                        className="text-xs text-brand bg-transparent border-0 cursor-pointer ml-1"
                      >
                        Rename
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(area)}
                  disabled={savingId === area.id}
                  className={`h-7 px-3 rounded-lg text-xs font-semibold border-0 cursor-pointer disabled:opacity-50 transition-colors ${
                    area.is_active
                      ? 'bg-danger/10 text-danger hover:bg-danger/20'
                      : 'bg-brand-tint text-brand hover:bg-brand-tint/80'
                  }`}
                >
                  {area.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Waitlist */}
        <section className="bg-white rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">Coverage waitlist ({waitlist.length})</h2>
            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showWaitlist}
                  onChange={e => setShowWaitlist(e.target.checked)}
                  className="rounded"
                />
                Show on map
              </label>
              {waitlist.length > 0 && (
                <button
                  type="button"
                  onClick={downloadCSV}
                  className="h-7 px-3 rounded-lg bg-surface text-ink text-xs font-semibold border border-line"
                >
                  Download CSV
                </button>
              )}
            </div>
          </div>

          {waitlist.length === 0 ? (
            <p className="text-sm text-ink-2">No waitlist entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-2 border-b border-line">
                    <th className="pb-2 pr-3 font-semibold">Email</th>
                    <th className="pb-2 pr-3 font-semibold">Date</th>
                    <th className="pb-2 font-semibold">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map(entry => (
                    <tr key={entry.id} className="border-b border-line/50 last:border-0">
                      <td className="py-2 pr-3 text-ink">{entry.email ?? <span className="text-ink-2 italic">No email</span>}</td>
                      <td className="py-2 pr-3 text-ink-2 whitespace-nowrap text-xs">
                        {new Date(entry.created_at).toLocaleDateString('en-NG')}
                      </td>
                      <td className="py-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${
                          nearestAreaForWaitlistEntry(entry) === 'Outside all areas'
                            ? 'bg-warn-tint text-warn'
                            : 'bg-brand-tint text-brand'
                        }`}>
                          {nearestAreaForWaitlistEntry(entry)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
