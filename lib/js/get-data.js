//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
  if (pt.name) {
    var names = pt.name.map(function(name) {
      return name.given.join(" ") + " " + name.family;
    });
    return names.join(" / ")
  } else {
    return "anonymous";
  }
}

// display the patient name, gender and dob in the index page
function displayPatient(pt) {
  document.getElementById('patient_name').innerHTML = getPatientName(pt);
  document.getElementById('gender').innerHTML = pt.gender;
  document.getElementById('dob').innerHTML = pt.birthDate;
  
}

//function to display list of medications
function displayMedication(meds) {
  med_list.innerHTML += "<li> " + meds + "</li>";
}

//helper function to get quanity and unit from an observation resoruce.
function getQuantityValueAndUnit(ob) {
  if (typeof ob != 'undefined' &&
    typeof ob.valueQuantity != 'undefined' &&
    typeof ob.valueQuantity.value != 'undefined' &&
    typeof ob.valueQuantity.unit != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2)) + ' ' + ob.valueQuantity.unit;
  } else {
    return undefined;
  }
}

// helper function to get both systolic and diastolic blood pressure
function getBloodPressureValue(BPObservations, typeOfPressure) {
  var formattedBPObservations = [];
  BPObservations.forEach(function(observation) {
    var BP = observation.component.find(function(component) {
      return component.code.coding.find(function(coding) {
        return coding.code == typeOfPressure;
      });
    });
    if (BP) {
      observation.valueQuantity = BP.valueQuantity;
      formattedBPObservations.push(observation);
    }
  });

  return getQuantityValueAndUnit(formattedBPObservations[0]);
}

// create a patient object to initalize the patient
function defaultPatient() {
  return {
    height: {
      value: ''
    },
    weight: {
      value: ''
    },
    sys: {
      value: ''
    },
    dia: {
      value: ''
    },
    ldl: {
      value: ''
    },
    hdl: {
      value: ''
    },
    totalCh: {     // total cholesterol
      value: ''
    },
    note: 'No Annotation',
    risk: '',
  };
    
}

//helper function to display the annotation on the index page
function displayAnnotation(annotation) {
  note.innerHTML = annotation;
}

//function to display the observation values you will need to update this
function displayObservation(obs) {
  height.innerHTML = obs.height // height
  weight.innerHTML = obs.weight // weight
  hdl.innerHTML = obs.hdl;
  ldl.innerHTML = obs.ldl;
  sys.innerHTML = obs.sys;
  dia.innerHTML = obs.dia;

  totalCh.innerHTML = obs.totalCh; // total cholesterol
}

//once fhir client is authorized then the following functions can be executed
FHIR.oauth2.ready().then(function(client) {

  // get patient object and then display its demographics info in the banner
  client.request(`Patient/${client.patient.id}`).then(
    function(patient) {
      displayPatient(patient);
      console.log(patient);
    }
  );

  // get observation resoruce values
  // you will need to update the below to retrive the weight and height values
  var query = new URLSearchParams();

  query.set("patient", client.patient.id);
  query.set("_count", 100);
  query.set("_sort", "-date");
  query.set("code", [
    'http://loinc.org|8462-4',
    'http://loinc.org|8480-6',
    'http://loinc.org|2085-9',
    'http://loinc.org|2089-1',
    'http://loinc.org|2093-3',
    'http://loinc.org|55284-4',
    'http://loinc.org|3141-9', // body weight measured
    'http://loinc.org|3137-7', // body height measured
    'http://loinc.org|29463-7', // body weight
    'http://loinc.org|8302-2', // body height
  ].join(","));

  client.request("Observation?" + query, {
    pageLimit: 0,
    flat: true
  }).then(
    function(ob) {

      // group all of the observation resoruces by type into their own
      var byCodes = client.byCodes(ob, 'code');
      var systolicbp = getBloodPressureValue(byCodes('55284-4'), '8480-6');
      var diastolicbp = getBloodPressureValue(byCodes('55284-4'), '8462-4');
      var hdl = byCodes('2085-9');
      var ldl = byCodes('2089-1');
      var totalCh = byCodes('2093-3'); // Cholesterol [Mass/volume] in Serum or Plasma
      var weight = byCodes('29463-7'); // weight view
      var height = byCodes('8302-2'); // height view

      // create patient object
      var p = defaultPatient();

      // set patient value parameters to the data pulled from the observation resoruce
      if (typeof systolicbp != 'undefined') {
        p.sys = systolicbp;
      } else {
        p.sys = 'undefined'
      }

      if (typeof diastolicbp != 'undefined') {
        p.dia = diastolicbp;
      } else {
        p.dia = 'undefined'
      }

      p.hdl = getQuantityValueAndUnit(hdl[0]);
      p.ldl = getQuantityValueAndUnit(ldl[0]);
      p.totalCh = getQuantityValueAndUnit(totalCh[0]); // get total cholesterol
      p.height = getQuantityValueAndUnit(height[0]); // get height
      p.weight = getQuantityValueAndUnit(weight[0]); // get weight

      newNote = totalCh[0];
      displayObservation(p)

    });


  // dummy data for medrequests
  //var medResults = ["SAMPLE Lasix 40mg","SAMPLE Naproxen sodium 220 MG Oral Tablet","SAMPLE Amoxicillin 250 MG"]

  // get medication request resources this will need to be updated
  // the goal is to pull all the medication requests and display it in the app. It can be both active and stopped medications
  //medResults.forEach(function(med) {
    //displayMedication(med);
  //})

  client.request("/MedicationRequest?patient=" + client.patient.id, {
    resolveReferences: [ "medicationReference" ],graph: true}).then(function(data) {
      if (!data.entry || !data.entry.length) {
        throw new Error("Error!");
        displayMedication("Error!");
      } else {
        data.entry.forEach(function(entry) {
          displayMedication(entry.resource.medicationCodeableConcept.text);
        })
      }
    });
  

  //update function to take in text input from the app and add the note for the latest observation annotation
  //you should include text and the author can be set to anything of your choice. keep in mind that this data will
  // be posted to a public sandbox
  /*function addAnnotation() {
    //var annotation = "test annotation" 
    // Get annotation notes from the input
    var annotationValue = document.getElementById('annotation').value;
    var annotation = "";
    annotation += annotationValue;
    annotation += " [author: " + newNote.note[0].authorString + "]";
    annotation += " [date: " + newNote.note[0].time + "]";
    
    displayAnnotation(annotation);

  }

  //event listner when the add button is clicked to call the function that will add the note to the weight observation
  document.getElementById('add').addEventListener('click', addAnnotation);
  */

  
  function displayRisk(riskResult) {
    risk.innerHTML = riskResult;
  }
  // Calculate the risk score based on the published model 
  function getRiskScore() {
    // arbitary average age 55
    // var age = 55.0
    var SBP = parseFloat(getQuantityValueAndUnit(systolicbp[0]));
    var HDL = parseFloat(getQuantityValueAndUnit(hdl[0]));
    var totalChValue = parseFloat(getQuantityValueAndUnit(totalCh[0]));
    
    var miu = (15.53 + 28.44 - (1.479 + 14.459)*(Math.log(55)) + 1.8515*(Math.log(55))*(Math.log(55)) - 0.912*Math.log(SBP)-0.2767-0.7181*(Math.log(totalChValue)/Math.log(HDL))-0.3758);
    var theta = (0.9145 - 0.2784*miu);
    var u = (Math.log(10) - miu)/Math.exp(miu);
    var s = Math.exp(u);
    var t = Math.exp(0.0-s);
    var riskProb = 1-t;

    displayRisk(riskProb);
  }

  document.getElementById('calculate').addEventListener('click', getRiskScore);


}).catch(console.error);
