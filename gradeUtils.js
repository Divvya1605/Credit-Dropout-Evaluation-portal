/**
 * gradeUtils.js  — EduPortal v2
 * Handles: theory, practical (single mark), lab2 (CIAP+ESEP)
 */

function getGrade(pct) {
  if (pct >= 80) return { grade:'O',  gradePoint:10 };
  if (pct >= 75) return { grade:'A+', gradePoint:9  };
  if (pct >= 70) return { grade:'A',  gradePoint:8  };
  if (pct >= 60) return { grade:'B+', gradePoint:7  };
  if (pct >= 50) return { grade:'B',  gradePoint:6  };
  if (pct >= 45) return { grade:'C',  gradePoint:5  };
  if (pct >= 40) return { grade:'P',  gradePoint:4  };
  return               { grade:'F',  gradePoint:0  };
}

function evaluateSubject(subj, mark, credit) {
  const type = subj.type;
  let totalObt = 0, totalMax = 0, kt = false, ktReason = null;

  if (type === 'theory') {
    const ese = parseFloat(mark.ese_obt) || 0;
    const mse = parseFloat(mark.mse_obt) || 0;
    const ise = parseFloat(mark.ise_obt) || 0;
    totalObt = ese + mse + ise;
    totalMax = (subj.ese_max||0) + (subj.mse_max||0) + (subj.ise_max||0);
    const intMax = (subj.mse_max||0) + (subj.ise_max||0);
    if (intMax > 0 && ((mse+ise)/intMax)*100 < 40) { kt = true; ktReason = 'Internal KT'; }
    if ((subj.ese_max||0) > 0 && (ese/subj.ese_max)*100 < 40) { kt = true; ktReason = (ktReason ? ktReason+' | ' : '') + 'ESE KT'; }
  } else if (type === 'lab2') {
    const ciap = parseFloat(mark.ciap_obt) || 0;
    const esep = parseFloat(mark.esep_obt) || 0;
    totalObt = ciap + esep;
    totalMax = (subj.ciap_max||0) + (subj.esep_max||0);
    if (totalMax > 0 && (totalObt/totalMax)*100 < 40) { kt = true; ktReason = 'Practical Fail'; }
  } else {
    const apl = parseFloat(mark.apl_obt) || 0;
    totalObt = apl;
    totalMax = (subj.apl_max||0);
    if (totalMax > 0 && (totalObt/totalMax)*100 < 40) { kt = true; ktReason = 'Practical Fail'; }
  }

  const pct = totalMax > 0 ? (totalObt / totalMax) * 100 : 0;
  if (kt) return { totalObt, totalMax, percentage:+pct.toFixed(2), grade:'F', gradePoint:0, creditPoints:0, kt:true, ktReason, pass:false };
  const { grade, gradePoint } = getGrade(pct);
  return { totalObt, totalMax, percentage:+pct.toFixed(2), grade, gradePoint, creditPoints:+(credit*gradePoint).toFixed(2), kt:false, ktReason:null, pass:true };
}

function calculateSGPI(results) {
  let totalCredits = 0, totalCP = 0, hasKT = false;
  for (const r of results) {
    if (r.kt) { hasKT = true; continue; }
    totalCredits += r.credit;
    totalCP      += r.creditPoints;
  }
  const sgpi = (!hasKT && totalCredits > 0) ? +(totalCP/totalCredits).toFixed(2) : null;
  return { sgpi, totalCredits, totalCreditPoints:+totalCP.toFixed(2), hasKT };
}

function calculateCGPI(semResults) {
  let totalCP = 0, totalCr = 0, anyKT = false;
  for (const s of semResults) {
    if (s.hasKT) { anyKT = true; continue; }
    totalCP += s.totalCreditPoints;
    totalCr += s.totalCredits;
  }
  return totalCr > 0 && !anyKT ? +(totalCP/totalCr).toFixed(2) : null;
}

module.exports = { getGrade, evaluateSubject, calculateSGPI, calculateCGPI };