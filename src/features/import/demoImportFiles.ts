const scheduleCsv = `project_id,baseline_version,activity_id,wbs_id,activity_name,owner,baseline_start,baseline_finish,forecast_start,forecast_finish,actual_start,actual_finish,predecessor_links,calendar_id,constraint_type,constraint_date,is_milestone,baseline_budget,progress_method,commentary\r
ASTER,B0,A-001,WP100,Design and enabling works,Design lead,2026-04-06,2026-04-26,2026-04-06,2026-04-26,2026-04-06,2026-04-25,,CAL-5D,none,,false,240000,percent_complete,Design package accepted\r
ASTER,B0,A-002,WP200,Civil and structural works,Civil lead,2026-04-27,2026-05-24,2026-04-27,2026-05-28,2026-04-27,2026-05-28,A-001|FS|0,CAL-5D,none,,false,720000,percent_complete,Structural rework completed\r
ASTER,B0,A-003,WP300,Mechanical installation,Mechanical lead,2026-05-25,2026-06-21,2026-05-29,2026-06-28,2026-05-29,,A-002|FS|0,CAL-5D,none,,false,600000,percent_complete,Alignment recovery shift proposed\r
ASTER,B0,A-004,WP400,Electrical controls and sensors,Controls lead,2026-06-01,2026-06-28,2026-06-05,2026-07-12,,,A-003|FS|0,CAL-5D,none,,false,600000,percent_complete,Panel FAT trigger breached\r
ASTER,B0,A-005,WP500,Integration testing and handover,Commissioning lead,2026-06-29,2026-07-26,2026-07-06,2026-08-03,,,A-004|FS|0,CAL-5D,none,,false,240000,percent_complete,Test scripts in preparation\r
`;

const performanceCsv = `project_id,baseline_version,period_end,activity_id,pv_period,ev_period,ac_period,physical_percent_complete,remaining_cost_forecast,progress_commentary\r
ASTER,B0,2026-06-14,A-001,240000,240000,235000,100,0,Complete\r
ASTER,B0,2026-06-14,A-002,720000,680000,730000,94.4,40000,Rework closed\r
ASTER,B0,2026-06-14,A-003,400000,330000,355000,55,270000,Recovery action active\r
ASTER,B0,2026-06-14,A-004,120000,90000,110000,15,510000,FAT defects under review\r
ASTER,B0,2026-06-14,A-005,20000,10000,10000,4.2,230000,Early test preparation\r
`;

export interface SyntheticImportFiles {
  schedule: File;
  performance: File;
}

export function createSyntheticImportFiles(): SyntheticImportFiles {
  return {
    schedule: new File([scheduleCsv], "aster-schedule.csv", {
      type: "text/csv;charset=utf-8",
    }),
    performance: new File([performanceCsv], "aster-performance.csv", {
      type: "text/csv;charset=utf-8",
    }),
  };
}
