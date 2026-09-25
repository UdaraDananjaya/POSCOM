<script setup>
import { ref } from 'vue';
import { doc, setDoc, deleteDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, useCollection, COL } from '@myshop/shared';

const tab = ref('classes');

const { data: taxClasses } = useCollection(COL.TAX_CLASSES);
const { data: geoZones } = useCollection(COL.GEO_ZONES);
const { data: taxRates } = useCollection(COL.TAX_RATES);

// --- Tax classes ---
const classDialog = ref(false);
const classForm = ref({ name: '' });
function newClass() { classForm.value = { name: '' }; classDialog.value = true; }
async function saveClass() {
  await setDoc(doc(collection(db, COL.TAX_CLASSES)), { name: classForm.value.name, dateCreated: serverTimestamp() });
  classDialog.value = false;
}
async function removeClass(c) {
  if (confirm(`Delete tax class "${c.name}"?`)) await deleteDoc(doc(db, COL.TAX_CLASSES, c.id));
}

// --- Geo zones ---
const zoneDialog = ref(false);
const zoneForm = ref({ name: '', description: '', zonesText: '' });
function newZone() { zoneForm.value = { name: '', description: '', zonesText: 'US,*,*' }; zoneDialog.value = true; }
async function saveZone() {
  const zones = zoneForm.value.zonesText.split('\n').filter(Boolean).map((line) => {
    const [countryCode, zoneCode, city] = line.split(',').map((s) => s.trim());
    return { countryCode, zoneCode: zoneCode && zoneCode !== '*' ? zoneCode : '', city: city && city !== '*' ? city : '' };
  });
  await setDoc(doc(collection(db, COL.GEO_ZONES)), {
    name: zoneForm.value.name, description: zoneForm.value.description, zones, dateCreated: serverTimestamp(),
  });
  zoneDialog.value = false;
}
async function removeZone(z) {
  if (confirm(`Delete geo zone "${z.name}"?`)) await deleteDoc(doc(db, COL.GEO_ZONES, z.id));
}

// --- Tax rates ---
const rateDialog = ref(false);
const rateForm = ref({ name: '', taxClassId: '', geoZoneId: '', type: 'percent', rate: 0, addressType: 'shipping' });
function newRate() { rateForm.value = { name: '', taxClassId: '', geoZoneId: '', type: 'percent', rate: 0, addressType: 'shipping' }; rateDialog.value = true; }
async function saveRate() {
  await setDoc(doc(collection(db, COL.TAX_RATES)), { ...rateForm.value, rate: Number(rateForm.value.rate) || 0, dateCreated: serverTimestamp() });
  rateDialog.value = false;
}
async function removeRate(r) {
  if (confirm(`Delete tax rate "${r.name}"?`)) await deleteDoc(doc(db, COL.TAX_RATES, r.id));
}
</script>

<template>
  <v-container class="py-6">
    <h1 class="text-h5 font-weight-bold mb-4">Tax &amp; geo zones</h1>
    <v-tabs v-model="tab" class="mb-4">
      <v-tab value="classes">Tax classes</v-tab>
      <v-tab value="zones">Geo zones</v-tab>
      <v-tab value="rates">Tax rates</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="classes">
        <v-btn size="small" color="primary" class="mb-3" prepend-icon="mdi-plus" @click="newClass">New tax class</v-btn>
        <v-list>
          <v-list-item v-for="c in taxClasses" :key="c.id" :title="c.name">
            <template #append><v-btn icon="mdi-delete-outline" variant="text" size="small" @click="removeClass(c)" /></template>
          </v-list-item>
        </v-list>
      </v-window-item>

      <v-window-item value="zones">
        <v-btn size="small" color="primary" class="mb-3" prepend-icon="mdi-plus" @click="newZone">New geo zone</v-btn>
        <v-list>
          <v-list-item v-for="z in geoZones" :key="z.id" :title="z.name" :subtitle="`${z.zones?.length || 0} zone rule(s)`">
            <template #append><v-btn icon="mdi-delete-outline" variant="text" size="small" @click="removeZone(z)" /></template>
          </v-list-item>
        </v-list>
      </v-window-item>

      <v-window-item value="rates">
        <v-btn size="small" color="primary" class="mb-3" prepend-icon="mdi-plus" @click="newRate">New tax rate</v-btn>
        <v-list>
          <v-list-item
            v-for="r in taxRates"
            :key="r.id"
            :title="r.name"
            :subtitle="`${r.type === 'percent' ? r.rate + '%' : '$' + r.rate} · ${taxClasses.find(c=>c.id===r.taxClassId)?.name || '—'} · ${geoZones.find(g=>g.id===r.geoZoneId)?.name || '—'}`"
          >
            <template #append><v-btn icon="mdi-delete-outline" variant="text" size="small" @click="removeRate(r)" /></template>
          </v-list-item>
        </v-list>
      </v-window-item>
    </v-window>

    <v-dialog v-model="classDialog" max-width="380">
      <v-card>
        <v-card-title>New tax class</v-card-title>
        <v-card-text><v-text-field v-model="classForm.name" label="Name (e.g. Standard, Reduced)" /></v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="classDialog = false">Cancel</v-btn><v-btn color="primary" @click="saveClass">Save</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="zoneDialog" max-width="480">
      <v-card>
        <v-card-title>New geo zone</v-card-title>
        <v-card-text>
          <v-text-field v-model="zoneForm.name" label="Name (e.g. European Union)" class="mb-2" />
          <v-textarea v-model="zoneForm.description" label="Description" rows="2" class="mb-2" />
          <v-textarea
            v-model="zoneForm.zonesText"
            label="Zone rules — one per line: countryCode,zoneCode,city (use * for any)"
            rows="4"
          />
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="zoneDialog = false">Cancel</v-btn><v-btn color="primary" @click="saveZone">Save</v-btn></v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="rateDialog" max-width="420">
      <v-card>
        <v-card-title>New tax rate</v-card-title>
        <v-card-text>
          <v-text-field v-model="rateForm.name" label="Name" class="mb-2" />
          <v-select v-model="rateForm.taxClassId" :items="taxClasses" item-title="name" item-value="id" label="Tax class" class="mb-2" />
          <v-select v-model="rateForm.geoZoneId" :items="geoZones" item-title="name" item-value="id" label="Geo zone" class="mb-2" />
          <v-select v-model="rateForm.type" :items="['percent', 'fixed']" label="Type" class="mb-2" />
          <v-text-field v-model="rateForm.rate" label="Rate (% or fixed amount)" type="number" class="mb-2" />
          <v-select v-model="rateForm.addressType" :items="['shipping', 'payment']" label="Match against" />
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="rateDialog = false">Cancel</v-btn><v-btn color="primary" @click="saveRate">Save</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
