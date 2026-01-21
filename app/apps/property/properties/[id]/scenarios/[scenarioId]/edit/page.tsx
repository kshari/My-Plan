import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ScenarioForm from '@/components/property/scenario-form'

interface ScenarioEditPageProps {
  params: Promise<{ id: string; scenarioId: string }>
}

export default async function ScenarioEditPage({ params }: ScenarioEditPageProps) {
  const { id, scenarioId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const propertyId = parseInt(id)
  const scenarioIdNum = parseInt(scenarioId)
  
  if (isNaN(propertyId) || isNaN(scenarioIdNum)) {
    notFound()
  }

  // Fetch the property and verify it belongs to the user
  const { data: property, error: propertyError } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()

  if (propertyError || !property) {
    notFound()
  }

  // Fetch the scenario and verify it belongs to the property
  const { data: scenario, error: scenarioError } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('id', scenarioIdNum)
    .eq('Property ID', propertyId)
    .single()

  if (scenarioError || !scenario) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link 
              href="/"
              className="text-xl font-bold text-gray-900 hover:text-gray-700"
            >
              ← My Plan / Property Investment
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href={`/apps/property/properties/${propertyId}/scenarios/${scenarioIdNum}`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Back to Scenario
              </Link>
              <Link
                href="/apps/property/dashboard"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link 
          href={`/apps/property/properties/${propertyId}/scenarios/${scenarioIdNum}`}
          className="mb-6 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to Scenario
        </Link>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Edit Scenario</h2>
          <ScenarioForm 
            propertyId={propertyId}
            scenarioId={scenarioIdNum}
            initialData={scenario}
            propertyAskingPrice={property['Asking Price']}
            propertyGrossIncome={property['Gross Income']}
            propertyOperatingExpenses={property['Operating Expenses']}
          />
        </div>
      </main>
    </div>
  )
}
