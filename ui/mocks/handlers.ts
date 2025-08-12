import { http, HttpResponse } from 'msw'
import { delay } from 'msw'
import * as amplify from '../aws-exports.json';

const dataClassifier = [
    {
    "new_headers": [
        "department_id:ID",
        "factory_id:string",
        "department_name:string", 
        "manager_id:string",
        ":LABEL"
    ],
    "original_headers": [
        "department_id",
        "factory_id",
        "department_name",
        "manager_id"
    ],
    "edge_count": "7",
    "edges": "{\n  \"matching_edges\": [\n    \"[Department] —(BELONGS_TO)→ [Factory]\",\n    \"[Department] —(MANAGED_BY)→ [Employee]\"\n  ],\n  \"edge_definitions\": [\n    \"department_id,BELONGS_TO,factory_id\",\n    \"department_id,MANAGED_BY,manager_id\"\n  ]\n}",
    "row_count": "23",
    "timestamp": "2025-05-01T08:06:50Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_7.csv",
    "file_name": "Department.csv",
    "id": "etl-1",
    "node_label": "Department",
    "output_key": "output/v/v_Department_23.csv"
},
{
    "new_headers": [
        "department_id:ID",
        "factory_id:string", 
        "department_name:string",
        "manager_id:string",
        ":LABEL"
    ],
    "original_headers": [
        "department_id",
        "factory_id",
        "department_name",
        "manager_id"
    ],
    "edge_count": "43",
    "edges": "{\n  \"matching_edges\": [\n    \"[Department] —(BELONGS_TO)→ [Factory]\",\n    \"[Department] —(MANAGED_BY)→ [Employee]\"\n  ],\n  \"edge_definitions\": [\n    \"department_id,BELONGS_TO,factory_id\",\n    \"department_id,MANAGED_BY,manager_id\"\n  ]\n}",
    "row_count": "88",
    "timestamp": "2025-10-09T23:33:51Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_43.csv",
    "file_name": "Department.csv",
    "id": "etl-2",
    "node_label": "Department",
    "output_key": "output/v/v_Department_88.csv"
},
{
    "new_headers": [
        "department_id:ID",
        "factory_id:string",
        "department_name:string",
        "manager_id:string",
        ":LABEL"
    ],
    "original_headers": [
        "department_id",
        "factory_id",
        "department_name",
        "manager_id"
    ],
    "edge_count": "34",
    "edges": "{\n  \"matching_edges\": [\n    \"[Department] —(BELONGS_TO)→ [Factory]\",\n    \"[Department] —(MANAGED_BY)→ [Employee]\"\n  ],\n  \"edge_definitions\": [\n    \"department_id,BELONGS_TO,factory_id\",\n    \"department_id,MANAGED_BY,manager_id\"\n  ]\n}",
    "row_count": "50",
    "timestamp": "2025-10-01T16:57:52Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_34.csv",
    "file_name": "Department.csv",
    "id": "etl-3",
    "node_label": "Department",
    "output_key": "output/v/v_Department_50.csv"
},
{
    "new_headers": [
        "department_id:ID",
        "factory_id:string",
        "department_name:string",
        "manager_id:string",
        ":LABEL"
    ],
    "original_headers": [
        "department_id",
        "factory_id",
        "department_name",
        "manager_id"
    ],
    "edge_count": "43",
    "edges": "{\n  \"matching_edges\": [\n    \"[Department] —(BELONGS_TO)→ [Factory]\",\n    \"[Department] —(MANAGED_BY)→ [Employee]\"\n  ],\n  \"edge_definitions\": [\n    \"department_id,BELONGS_TO,factory_id\",\n    \"department_id,MANAGED_BY,manager_id\"\n  ]\n}",
    "row_count": "23",
    "timestamp": "2025-02-02T18:50:53Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_43.csv",
    "file_name": "Department.csv",
    "id": "etl-4",
    "node_label": "Department",
    "output_key": "output/v/v_Department_23.csv"
},
{
     "new_headers": [
        "department_id:ID",
        "factory_id:string",
        "department_name:string",
        "manager_id:string",
        ":LABEL"
    ],
    "original_headers": [
        "department_id",
        "factory_id",
        "department_name",
        "manager_id"
    ],
    "edge_count": "40",
    "edges": "{\n  \"matching_edges\": [\n    \"[Department] —(BELONGS_TO)→ [Factory]\",\n    \"[Department] —(MANAGED_BY)→ [Employee]\"\n  ],\n  \"edge_definitions\": [\n    \"department_id,BELONGS_TO,factory_id\",\n    \"department_id,MANAGED_BY,manager_id\"\n  ]\n}",
    "row_count": "92",
    "timestamp": "2025-12-10T00:49:54Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_40.csv",
    "file_name": "Department.csv",
    "id": "etl-5",
    "node_label": "Department",
    "output_key": "output/v/v_Department_92.csv"
},
{
    "new_headers": [
        "department_id:ID",
        "factory_id:string",
        "department_name:string",
        "manager_id:string",
        ":LABEL"
    ],
    "original_headers": [
        "department_id",
        "factory_id",
        "department_name",
        "manager_id"
    ],
    "edge_count": "13",
    "edges": "{\n  \"matching_edges\": [\n    \"[Department] —(BELONGS_TO)→ [Factory]\",\n    \"[Department] —(MANAGED_BY)→ [Employee]\"\n  ],\n  \"edge_definitions\": [\n    \"department_id,BELONGS_TO,factory_id\",\n    \"department_id,MANAGED_BY,manager_id\"\n  ]\n}",
    "row_count": "38",
    "timestamp": "2025-03-12T06:01:54Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_13.csv",
    "file_name": "Department.csv",
    "id": "etl-6",
    "node_label": "Department",
    "output_key": "output/v/v_Department_38.csv"
},
{
    "new_headers": [
        "department_id:ID",
        "factory_id:string",
        "department_name:string",
        "manager_id:string",
        ":LABEL"
    ],
    "original_headers": [
        "department_id",
        "factory_id",
        "department_name",
        "manager_id"
    ],
    "edge_count": "32",
    "edges": "{\n  \"matching_edges\": [\n    \"[Department] —(BELONGS_TO)→ [Factory]\",\n    \"[Department] —(MANAGED_BY)→ [Employee]\"\n  ],\n  \"edge_definitions\": [\n    \"department_id,BELONGS_TO,factory_id\",\n    \"department_id,MANAGED_BY,manager_id\"\n  ]\n}",
    "row_count": "43",
    "timestamp": "2025-04-23T15:51:55Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_32.csv",
    "file_name": "Department.csv",
    "id": "etl-7",
    "node_label": "Department",
    "output_key": "output/v/v_Department_43.csv"
},
{
    "new_headers": [
        "department_id:ID",
        "factory_id:string",
        "department_name:string",
        "manager_id:string",
        ":LABEL"
    ],
    "original_headers": [
        "department_id",
        "factory_id",
        "department_name",
        "manager_id"
    ],
    "edge_count": "4",
    "edges": "crapdata",
    "row_count": "42",
    "timestamp": "2025-06-13T09:03:56Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_4.csv",
    "file_name": "Department.csv",
    "id": "etl-8",
    "node_label": "Department",
    "output_key": "output/v/v_Department_42.csv"
},
{
    "new_headers": [
        "department_id:ID",
        "factory_id:string",
        "department_name:string",
        "manager_id:string",
        ":LABEL"
    ],
    "original_headers": [
        "department_id",
        "factory_id",
        "department_name",
        "manager_id"
    ],
    "edge_count": "28",
    "edges": "{\n  \"matching_edges\": [\n    \"[Department] —(BELONGS_TO)→ [Factory]\",\n    \"[Department] —(MANAGED_BY)→ [Employee]\"\n  ],\n  \"edge_definitions\": [\n    \"department_id,BELONGS_TO,factory_id\",\n    \"department_id,MANAGED_BY,manager_id\"\n  ]\n}",
    "row_count": "74",
    "timestamp": "2025-05-16T20:52:56Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_28.csv",
    "file_name": "Department.csv",
    "id": "etl-9",
    "node_label": "Department",
    "output_key": "output/v/v_Department_74.csv"
},
{
    "new_headers": "crapdata",
    "original_headers": [
        "department_id",
        "factory_id",
        "department_name",
        "manager_id"
    ],
    "edge_count": "22",
    "edges": "{\n  \"matching_edges\": [\n    \"[Department] —(BELONGS_TO)→ [Factory]\",\n    \"[Department] —(MANAGED_BY)→ [Employee]\"\n  ],\n  \"edge_definitions\": [\n    \"department_id,BELONGS_TO,factory_id\",\n    \"department_id,MANAGED_BY,manager_id\"\n  ]\n}",
    "row_count": "86",
    "timestamp": "2025-04-28T03:36:57Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_22.csv",
    "file_name": "Department.csv",
    "id": "etl-10",
    "node_label": "Department",
    "output_key": "output/v/v_Department_86.csv"
},
{
    "new_headers": [
        "department_id:ID",
        "factory_id:string",
        "department_name:string",
        "manager_id:string",
        ":LABEL"
    ],
    "original_headers": "crapdata",
    "edge_count": "29",
    "edges": "{\n  \"matching_edges\": [\n    \"[Department] —(BELONGS_TO)→ [Factory]\",\n    \"[Department] —(MANAGED_BY)→ [Employee]\"\n  ],\n  \"edge_definitions\": [\n    \"department_id,BELONGS_TO,factory_id\",\n    \"department_id,MANAGED_BY,manager_id\"\n  ]\n}",
    "row_count": "63",
    "timestamp": "2025-02-18T21:25:09Z",
    "unique_id": "department_id",
    "edge_output_key": "output-edges/e_Department_29.csv",
    "file_name": "Department.csv",
    "id": "etl-1",
    "node_label": "Department",
    "output_key": "output/v/v_Department_63.csv"
}
]

const BULK_LOAD_DATA = [
        {
            "payload": {
                "feedCount": [
                    {
                        "LOAD_COMPLETED": "1"
                    }
                ],
                "overallStatus": {
                    "totalRecords": "40",
                    "totalTimeSpent": "3", 
                    "insertErrors": "0",
                    "totalDuplicates": "40",
                    "datatypeMismatchErrors": "0",
                    "retryNumber": "0",
                    "runNumber": "2",
                    "startTime": "1742913478",
                    "fullUri": "s3://panoptic-etl-860998673098-us-east-1/output/v/v_Department_8.csv",
                    "parsingErrors": "0",
                    "status": "LOAD_COMPLETED"
                },
                "errors": {
                    "startIndex": "0",
                    "loadId": "cc30e072-11aa-4f78-b0d3-62e0904d367e",
                    "endIndex": "0",
                    "errorLogs": []
                }
            },
            "startTime": "2025-03-25 14:38:00",
            "totalRecords": "40",
            "sourcePath": "output/v/v_Department_8.csv",
            "loadId": "cc30e072-11aa-4f78-b0d3-62e0904d367e",
            "loadStatus": "LOAD_COMPLETED",
            "timeSpent": "3"
        },
        {
            "payload": {
                "feedCount": [
                    {
                        "LOAD_COMPLETED": "1"
                    }
                ],
                "overallStatus": {
                    "totalRecords": "88",
                    "totalTimeSpent": "5",
                    "insertErrors": "2",
                    "totalDuplicates": "86",
                    "datatypeMismatchErrors": "0",
                    "retryNumber": "1",
                    "runNumber": "3",
                    "startTime": "1742913500",
                    "fullUri": "s3://panoptic-etl-860998673098-us-east-1/output/v/v_Department_88.csv",
                    "parsingErrors": "0",
                    "status": "LOAD_COMPLETED"
                },
                "errors": {
                    "startIndex": "0",
                    "loadId": "dd40e073-12bb-4f79-b1d4-72e0904d368f",
                    "endIndex": "2",
                    "errorLogs": []
                }
            },
            "startTime": "2025-03-26 15:40:00",
            "totalRecords": "88",
            "sourcePath": "output/v/v_Department_88.csv",
            "loadId": "dd40e073-12bb-4f79-b1d4-72e0904d368f",
            "loadStatus": "LOAD_COMPLETED",
            "timeSpent": "5"
        },
        {
            "payload": {
                "feedCount": [
                    {
                        "LOAD_COMPLETED": "1"
                    }
                ],
                "overallStatus": {
                    "totalRecords": "50",
                    "totalTimeSpent": "4",
                    "insertErrors": "0",
                    "totalDuplicates": "50",
                    "datatypeMismatchErrors": "0",
                    "retryNumber": "0",
                    "runNumber": "1",
                    "startTime": "1742913600",
                    "fullUri": "s3://panoptic-etl-860998673098-us-east-1/output/v/v_Department_50.csv",
                    "parsingErrors": "0",
                    "status": "LOAD_COMPLETED"
                },
                "errors": {
                    "startIndex": "0",
                    "loadId": "ee50e074-13cc-4f80-b2d5-82e0904d369g",
                    "endIndex": "0",
                    "errorLogs": []
                }
            },
            "startTime": "2025-03-27 16:42:00",
            "totalRecords": "50",
            "sourcePath": "output/v/v_Department_50.csv",
            "loadId": "ee50e074-13cc-4f80-b2d5-82e0904d369g",
            "loadStatus": "LOAD_COMPLETED",
            "timeSpent": "4"
        },
        {
            "payload": {
                "feedCount": [
                    {
                        "LOAD_COMPLETED": "1"
                    }
                ],
                "overallStatus": {
                    "totalRecords": "23",
                    "totalTimeSpent": "2",
                    "insertErrors": "0",
                    "totalDuplicates": "23",
                    "datatypeMismatchErrors": "0",
                    "retryNumber": "0",
                    "runNumber": "4",
                    "startTime": "1742913700",
                    "fullUri": "s3://panoptic-etl-860998673098-us-east-1/output/v/v_Department_23.csv",
                    "parsingErrors": "0",
                    "status": "LOAD_COMPLETED"
                },
                "errors": {
                    "startIndex": "0",
                    "loadId": "ff60e075-14dd-4f81-b3d6-92e0904d370h",
                    "endIndex": "0",
                    "errorLogs": []
                }
            },
            "startTime": "2025-03-28 17:44:00",
            "totalRecords": "23",
            "sourcePath": "output/v/v_Department_23.csv",
            "loadId": "ff60e075-14dd-4f81-b3d6-92e0904d370h",
            "loadStatus": "LOAD_COMPLETED",
            "timeSpent": "2"
        },
        {
            "payload": {
                "feedCount": [
                    {
                        "LOAD_COMPLETED": "1"
                    }
                ],
                "overallStatus": {
                    "totalRecords": "92",
                    "totalTimeSpent": "6",
                    "insertErrors": "1",
                    "totalDuplicates": "91",
                    "datatypeMismatchErrors": "0",
                    "retryNumber": "1",
                    "runNumber": "2",
                    "startTime": "1742913800",
                    "fullUri": "s3://panoptic-etl-860998673098-us-east-1/output/v/v_Department_92.csv",
                    "parsingErrors": "0",
                    "status": "LOAD_COMPLETED"
                },
                "errors": {
                    "startIndex": "0",
                    "loadId": "gg70e076-15ee-4f82-b4d7-a2e0904d371i",
                    "endIndex": "1",
                    "errorLogs": []
                }
            },
            "startTime": "2025-03-29 18:46:00",
            "totalRecords": "92",
            "sourcePath": "output/v/v_Department_92.csv",
            "loadId": "gg70e076-15ee-4f82-b4d7-a2e0904d371i",
            "loadStatus": "LOAD_COMPLETED",
            "timeSpent": "6"
        },
        {
            "payload": {
                "feedCount": [
                    {
                        "LOAD_COMPLETED": "1"
                    }
                ],
                "overallStatus": {
                    "totalRecords": "38",
                    "totalTimeSpent": "3",
                    "insertErrors": "0",
                    "totalDuplicates": "38",
                    "datatypeMismatchErrors": "0",
                    "retryNumber": "0",
                    "runNumber": "3",
                    "startTime": "1742913900",
                    "fullUri": "s3://panoptic-etl-860998673098-us-east-1/output/v/v_Department_38.csv",
                    "parsingErrors": "0",
                    "status": "LOAD_COMPLETED"
                },
                "errors": {
                    "startIndex": "0",
                    "loadId": "hh80e077-16ff-4f83-b5d8-b2e0904d372j",
                    "endIndex": "0",
                    "errorLogs": []
                }
            },
            "startTime": "2025-03-30 19:48:00",
            "totalRecords": "38",
            "sourcePath": "output/v/v_Department_38.csv",
            "loadId": "hh80e077-16ff-4f83-b5d8-b2e0904d372j",
            "loadStatus": "LOAD_COMPLETED",
            "timeSpent": "3"
        },
        {
            "payload": {
                "feedCount": [
                    {
                        "LOAD_COMPLETED": "1"
                    }
                ],
                "overallStatus": {
                    "totalRecords": "43",
                    "totalTimeSpent": "4",
                    "insertErrors": "0",
                    "totalDuplicates": "43",
                    "datatypeMismatchErrors": "0",
                    "retryNumber": "0",
                    "runNumber": "1",
                    "startTime": "1742914000",
                    "fullUri": "s3://panoptic-etl-860998673098-us-east-1/output/v/v_Department_43.csv",
                    "parsingErrors": "0",
                    "status": "LOAD_COMPLETED"
                },
                "errors": {
                    "startIndex": "0",
                    "loadId": "ii90e078-17gg-4f84-b6d9-c2e0904d373k",
                    "endIndex": "0",
                    "errorLogs": []
                }
            },
            "startTime": "2025-03-31 20:50:00",
            "totalRecords": "43",
            "sourcePath": "output/v/v_Department_43.csv",
            "loadId": "ii90e078-17gg-4f84-b6d9-c2e0904d373k",
            "loadStatus": "LOAD_COMPLETED",
            "timeSpent": "4"
        },
        {
            "payload": {
                "feedCount": [
                    {
                        "LOAD_COMPLETED": "1"
                    }
                ],
                "overallStatus": {
                    "totalRecords": "42",
                    "totalTimeSpent": "3",
                    "insertErrors": "0",
                    "totalDuplicates": "42",
                    "datatypeMismatchErrors": "0",
                    "retryNumber": "0",
                    "runNumber": "2",
                    "startTime": "1742914100",
                    "fullUri": "s3://panoptic-etl-860998673098-us-east-1/output/v/v_Department_42.csv",
                    "parsingErrors": "0",
                    "status": "LOAD_COMPLETED"
                },
                "errors": {
                    "startIndex": "0",
                    "loadId": "jj10e079-18hh-4f85-b7e0-d2e0904d374l",
                    "endIndex": "0",
                    "errorLogs": []
                }
            },
            "startTime": "2025-04-01 21:52:00",
            "totalRecords": "42",
            "sourcePath": "output/v/v_Department_42.csv",
            "loadId": "jj10e079-18hh-4f85-b7e0-d2e0904d374l",
            "loadStatus": "LOAD_COMPLETED",
            "timeSpent": "3"
        },
        {
            "payload": {
                "feedCount": [
                    {
                        "LOAD_COMPLETED": "1"
                    }
                ],
                "overallStatus": {
                    "totalRecords": "74",
                    "totalTimeSpent": "5",
                    "insertErrors": "1",
                    "totalDuplicates": "73",
                    "datatypeMismatchErrors": "0",
                    "retryNumber": "1",
                    "runNumber": "3",
                    "startTime": "1742914200",
                    "fullUri": "s3://panoptic-etl-860998673098-us-east-1/output/v/v_Department_74.csv",
                    "parsingErrors": "0",
                    "status": "LOAD_COMPLETED"
                },
                "errors": {
                    "startIndex": "0",
                    "loadId": "kk20e080-19ii-4f86-b8e1-e2e0904d375m",
                    "endIndex": "1",
                    "errorLogs": []
                }
            },
            "startTime": "2025-04-02 22:54:00",
            "totalRecords": "74",
            "sourcePath": "output/v/v_Department_74.csv",
            "loadId": "kk20e080-19ii-4f86-b8e1-e2e0904d375m",
            "loadStatus": "LOAD_COMPLETED",
            "timeSpent": "5"
        },
        {
            "payload": {
                "feedCount": [
                    {
                        "LOAD_COMPLETED": "1"
                    }
                ],
                "overallStatus": {
                    "totalRecords": "86",
                    "totalTimeSpent": "6",
                    "insertErrors": "2",
                    "totalDuplicates": "84",
                    "datatypeMismatchErrors": "0",
                    "retryNumber": "1",
                    "runNumber": "4",
                    "startTime": "1742914300",
                    "fullUri": "s3://panoptic-etl-860998673098-us-east-1/output/v/v_Department_86.csv",
                    "parsingErrors": "0",
                    "status": "LOAD_COMPLETED"
                },
                "errors": {
                    "startIndex": "0",
                    "loadId": "ll30e081-20jj-4f87-b9e2-f2e0904d376n",
                    "endIndex": "2",
                    "errorLogs": []
                }
            },
            "startTime": "2025-04-03 23:56:00",
            "totalRecords": "86",
            "sourcePath": "output/v/v_Department_86.csv",
            "loadId": "ll30e081-20jj-4f87-b9e2-f2e0904d376n",
            "loadStatus": "LOAD_COMPLETED",
            "timeSpent": "6"
        }
]

const DATA_ANALYZER_DATA = [        {
            "results": "File: analyze\/batch9688gw\/order_details.csv\r\norder_details_id,order_id,pizza_id,quantity\r\n1,1,hawaiian_m,1\r\n2,2,classic_dlx_m,1\r\n3,2,five_cheese_l,1\r\n4,2,ital_supr_l,1\r\n5,2,mexicana_m,1\r\n6,2,thai_ckn_l,1\r\n7,3,ital_supr_m,1\r\n8,3,prsc_argla_l,1\r\n9,4,ital_supr_m,1\r\n10,5,ital_supr_m,1\r\n11,6,bbq_ckn_s,1\r\n12,6,the_greek_s,1\r\n13,7,spinach_supr_s,1\r\n14,8,spinach_supr_s,1\r\n15,9,classic_dlx_s,1\r\n16,9,green_garden_s,1\r\n17,9,ital_cpcllo_l,1\r\n18,9,ital_supr_l,1\r\n19,9,ital_supr_s,1\r\n20,9,mexicana_s,1\r\r\n\r\nFile: analyze\/batch9688gw\/orders.csv\r\norder_id,date,time\r\n1,2015-01-01,11:38:36\r\n2,2015-01-01,11:57:40\r\n3,2015-01-01,12:12:28\r\n4,2015-01-01,12:16:31\r\n5,2015-01-01,12:21:30\r\n6,2015-01-01,12:29:36\r\n7,2015-01-01,12:50:37\r\n8,2015-01-01,12:51:37\r\n9,2015-01-01,12:52:01\r\n10,2015-01-01,13:00:15\r\n11,2015-01-01,13:02:59\r\n12,2015-01-01,13:04:41\r\n13,2015-01-01,13:11:55\r\n14,2015-01-01,13:14:19\r\n15,2015-01-01,13:33:00\r\n16,2015-01-01,13:34:07\r\n17,2015-01-01,13:53:00\r\n18,2015-01-01,13:57:08\r\n19,2015-01-01,13:59:09\r\n20,2015-01-01,14:03:08\r\r\n\r\nFile: analyze\/batch9688gw\/pizza_types.csv\r\npizza_type_id,name,category,ingredients\r\nbbq_ckn,The Barbecue Chicken Pizza,Chicken,\"Barbecued Chicken, Red Peppers, Green Peppers, Tomatoes, Red Onions, Barbecue Sauce\"\r\ncali_ckn,The California Chicken Pizza,Chicken,\"Chicken, Artichoke, Spinach, Garlic, Jalapeno Peppers, Fontina Cheese, Gouda Cheese\"\r\nckn_alfredo,The Chicken Alfredo Pizza,Chicken,\"Chicken, Red Onions, Red Peppers, Mushrooms, Asiago Cheese, Alfredo Sauce\"\r\nckn_pesto,The Chicken Pesto Pizza,Chicken,\"Chicken, Tomatoes, Red Peppers, Spinach, Garlic, Pesto Sauce\"\r\nsouthw_ckn,The Southwest Chicken Pizza,Chicken,\"Chicken, Tomatoes, Red Peppers, Red Onions, Jalapeno Peppers, Corn, Cilantro, Chipotle Sauce\"\r\nthai_ckn,The Thai Chicken Pizza,Chicken,\"Chicken, Pineapple, Tomatoes, Red Peppers, Thai Sweet Chilli Sauce\"\r\nbig_meat,The Big Meat Pizza,Classic,\"Bacon, Pepperoni, Italian Sausage, Chorizo Sausage\"\r\nclassic_dlx,The Classic Deluxe Pizza,Classic,\"Pepperoni, Mushrooms, Red Onions, Red Peppers, Bacon\"\r\nhawaiian,The Hawaiian Pizza,Classic,\"Sliced Ham, Pineapple, Mozzarella Cheese\"\r\nital_cpcllo,The Italian Capocollo Pizza,Classic,\"Capocollo, Red Peppers, Tomatoes, Goat Cheese, Garlic, Oregano\"\r\nnapolitana,The Napolitana Pizza,Classic,\"Tomatoes, Anchovies, Green Olives, Red Onions, Garlic\"\r\npep_msh_pep,\"The Pepperoni, Mushroom, and Peppers Pizza\",Classic,\"Pepperoni, Mushrooms, Green Peppers\"\r\npepperoni,The Pepperoni Pizza,Classic,\"Mozzarella Cheese, Pepperoni\"\r\nthe_greek,The Greek Pizza,Classic,\"Kalamata Olives, Feta Cheese, Tomatoes, Garlic, Beef Chuck Roast, Red Onions\"\r\nbrie_carre,The Brie Carre Pizza,Supreme,\"Brie Carre Cheese, Prosciutto, Caramelized Onions, Pears, Thyme, Garlic\"\r\ncalabrese,The Calabrese Pizza,Supreme,\"\u2018Nduja Salami, Pancetta, Tomatoes, Red Onions, Friggitello Peppers, Garlic\"\r\nital_supr,The Italian Supreme Pizza,Supreme,\"Calabrese Salami, Capocollo, Tomatoes, Red Onions, Green Olives, Garlic\"\r\npeppr_salami,The Pepper Salami Pizza,Supreme,\"Genoa Salami, Capocollo, Pepperoni, Tomatoes, Asiago Cheese, Garlic\"\r\nprsc_argla,The Prosciutto and Arugula Pizza,Supreme,\"Prosciutto di San Daniele, Arugula, Mozzarella Cheese\"\r\nsicilian,The Sicilian Pizza,Supreme,\"Coarse Sicilian Salami, Tomatoes, Green Olives, Luganega Sausage, Onions, Garlic\"\r\r\n\r\nFile: analyze\/batch9688gw\/pizzas.csv\r\npizza_id,pizza_type_id,size,price\r\nbbq_ckn_s,bbq_ckn,S,12.75\r\nbbq_ckn_m,bbq_ckn,M,16.75\r\nbbq_ckn_l,bbq_ckn,L,20.75\r\ncali_ckn_s,cali_ckn,S,12.75\r\ncali_ckn_m,cali_ckn,M,16.75\r\ncali_ckn_l,cali_ckn,L,20.75\r\nckn_alfredo_s,ckn_alfredo,S,12.75\r\nckn_alfredo_m,ckn_alfredo,M,16.75\r\nckn_alfredo_l,ckn_alfredo,L,20.75\r\nckn_pesto_s,ckn_pesto,S,12.75\r\nckn_pesto_m,ckn_pesto,M,16.75\r\nckn_pesto_l,ckn_pesto,L,20.75\r\nsouthw_ckn_s,southw_ckn,S,12.75\r\nsouthw_ckn_m,southw_ckn,M,16.75\r\nsouthw_ckn_l,southw_ckn,L,20.75\r\nthai_ckn_s,thai_ckn,S,12.75\r\nthai_ckn_m,thai_ckn,M,16.75\r\nthai_ckn_l,thai_ckn,L,20.75\r\nbig_meat_s,big_meat,S,12\r\nbig_meat_m,big_meat,M,16\r\r\n\r\n",
            "file_count": "4",
            "id": "00211cdb-a378-4ca5-9674-6f51739cf534",
            "file_name": "analyze\/batch9688gw",
            "schema": "\n-- Factories Table\nCREATE TABLE factories (\n    factory_id VARCHAR(10) PRIMARY KEY,\n    factory_name VARCHAR(100) NOT NULL,\n    location VARCHAR(100) NOT NULL,\n    year_opened INTEGER NOT NULL,\n    total_sqft INTEGER NOT NULL,\n    employee_count INTEGER NOT NULL\n);\n\n-- Work Areas Table\nCREATE TABLE work_areas (\n    workarea_id VARCHAR(10) PRIMARY KEY,\n    factory_id VARCHAR(10) NOT NULL,\n    area_name VARCHAR(100) NOT NULL,\n    area_type VARCHAR(50) NOT NULL,\n    sqft INTEGER NOT NULL,\n    max_capacity INTEGER NOT NULL,\n    shift_count INTEGER NOT NULL,\n    FOREIGN KEY (factory_id) REFERENCES factories(factory_id)\n);\n\n-- Machines Table\nCREATE TABLE machines (\n    machine_id VARCHAR(10) PRIMARY KEY,\n    workarea_id VARCHAR(10) NOT NULL,\n    machine_type VARCHAR(50) NOT NULL,\n    manufacturer VARCHAR(100) NOT NULL,\n    model_num VARCHAR(50) NOT NULL,\n    install_date DATE NOT NULL,\n    last_maintenance DATE NOT NULL,\n    status VARCHAR(20) NOT NULL,\n    FOREIGN KEY (workarea_id) REFERENCES work_areas(workarea_id)\n);\n\n-- Suppliers Table\nCREATE TABLE suppliers (\n    supplier_id VARCHAR(10) PRIMARY KEY,\n    supplier_name VARCHAR(100) NOT NULL,\n    on_time_delivery_rate DECIMAL(5,2) NOT NULL,\n    quality_score DECIMAL(5,2) NOT NULL,\n    cost_per_unit DECIMAL(10,2) NOT NULL\n);\n",
            "timestamp": "2025-05-06T11:34:17Z"
        },
        {
            "results": "File: analyze\/batch7051mu\/BatchSupplier.csv\r\nBatchSupplier_ID,Batch_ID,Supplier_ID,Material_Lot_Number,Delivery_Date,Quality_Check_Status,On_Time_Delivery,Quantity_Received,Quantity_Accepted,Rejection_Rate,Payment_Terms,Invoice_Number,Payment_Status,Notes\r\nBS00001,PB00001,SPL100001,ML-78542-01-S1,2024-12-15,Passed,Yes,3500,3450,1.43,Net 60,INV-SPL100001-12345,Paid,\"Steel components for housing and threaded collar\"\r\nBS00002,PB00001,SPL100002,ML-78542-01-S2,2024-12-16,Passed,Yes,2800,2750,1.79,Net 45,INV-SPL100002-23456,Paid,\"Steel components for center tube and springs\"\r\n\r\nFile: analyze\/batch7051mu\/EBOM.csv\r\nEBOM_ID,Batch_ID,Product_ID,Part_ID,Quantity_Per_Unit,Revision_Number,Effective_Date,Status,Engineering_Approval,Quality_Approval,Manufacturing_Approval,Notes\r\nEBOM10001,PB00001,PRD10001,PRT20001,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\r\nEBOM10002,PB00001,PRD10001,PRT20002,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\r\n\r\nFile: analyze\/batch7051mu\/Facility.csv\r\nFacility_ID,Facility_Name,Facility_Type,Address_Line1,Address_Line2,City,State,Zip_Code,Country,Phone_Number,Email,Square_Footage,Year_Built,Ownership_Type,Production_Capacity_Units_Day,Warehouse_Capacity_Pallets,Number_of_Loading_Docks,Number_of_Production_Lines,Number_of_Employees,Operating_Hours,Maintenance_Schedule,ISO_Certified,Last_Audit_Date,Energy_Consumption_kWh_Month,Water_Usage_Gallons_Month,Waste_Management_Vendor,Security_Level,Insurance_Policy_Number,Property_Tax_ID,Facility_Manager,Emergency_Contact,Latitude,Longitude\r\nFAC001,Detroit Manufacturing Center,Production,2122 Woodward Ave,,Detroit,MI,48201,USA,313-555-7890,detroit.ops@oai-auto.com,325000,1998,Owned,12500,8500,18,6,450,24\/7,Quarterly,Yes,2025-01-15,685000,420000,Waste Management Inc.,Level 3,POL-78542-DTM,DTX-45678-01,Michael Johnson,313-555-9012,42.3385,-83.0524\r\nFAC002,Cleveland Assembly Plant,Assembly,1265 Industrial Parkway,,Cleveland,OH,44135,USA,216-555-4321,cleveland.ops@oai-auto.com,275000,2005,Leased,9800,6200,14,5,380,24\/7,Bi-monthly,Yes,2025-02-10,580000,350000,Republic Services,Level 3,POL-65432-CLV,CTX-78901-02,Sarah Williams,216-555-6789,41.4374,-81.8459\r\n\r\nFile: analyze\/batch7051mu\/LineConfiguration.csv\r\nConfig_ID,Line_ID,Machine_ID,Sequence_Number,Setup_Time_Minutes,Changeover_Time_Minutes,Bottleneck_Status,Last_Calibration_Date,Next_Calibration_Date,Operator_Skill_Level_Required,Maintenance_Priority\r\nLC001,PL001,MCH001,1,45,90,No,2025-02-05,2025-05-05,3,Medium\r\nLC002,PL001,MCH002,2,30,60,No,2025-02-10,2025-05-10,3,Medium\r\n\r\nFile: analyze\/batch7051mu\/Machine.csv\r\nMachine_ID,Machine_Name,Machine_Type,Manufacturer,Model_Number,Serial_Number,Installation_Date,Last_Maintenance_Date,Next_Maintenance_Date,Machine_Status,Max_Capacity_Units_Hour,Current_Efficiency_Percentage,Power_Consumption_kWh,Warranty_Expiration_Date,Purchase_Cost,Maintenance_Cost_Annual,Expected_Lifespan_Years,Software_Version,Control_System_Type,Product_Category\r\nMCH001,Steel Stamping Press,Stamping,Schuler Group,SP-5000,SP5K-78542,2018-03-15,2025-02-10,2025-05-10,Active,450,92.5,75,2028-03-15,285000,12500,15,v3.2.1,Siemens S7-1500,Oil Filters\r\nMCH002,Filter Housing Welder,Welding,FANUC,FW-2200,FW22-65432,2018-04-20,2025-02-15,2025-05-15,Active,380,94.3,65,2028-04-20,210000,9800,12,v4.1.0,FANUC R-30iB,Oil Filters\r\n\r\nFile: analyze\/batch7051mu\/Part.csv\r\nPart_ID,Part_Name,Part_Category,Product_ID,Material_Type,Supplier_ID,Unit_Cost,Min_Stock_Level,Lead_Time_Days,Status\r\nPRT20001,Steel Housing Canister,Metal Components,PRD10001,Steel,SPL100001,2.50,200,30,Active\r\nPRT20002,Steel Center Tube,Metal Components,PRD10001,Steel,SPL100002,1.20,300,25,Active\r\n\r\nFile: analyze\/batch7051mu\/Product.csv\r\nProduct_ID,Product_Name,Product_Category,Description,Base_Price,Warranty_Period_Months,Min_Order_Qty,Lead_Time_Days,Status\r\nPRD10001,Premium Oil Filter,Oil Filters,High-performance oil filter with extended service life,12.99,12,50,14,Active\r\nPRD10002,Economy Oil Filter,Oil Filters,Cost-effective oil filter for standard maintenance,8.99,6,100,10,Active\r\n\r\nFile: analyze\/batch7051mu\/ProductionBatch.csv\r\nBatch_ID,Product_ID,Line_ID,Facility_ID,Production_Date,Shift,Quantity_Produced,Quantity_Rejected,Start_Time,End_Time,Cycle_Time_Seconds,Operator_ID,Quality_Check_Status,Material_Lot_Number,Downtime_Minutes,Energy_Consumption_kWh,Notes\r\nPB00001,PRD10001,PL001,FAC001,2025-01-01,Morning,2850,32,07:00:00,15:00:00,8.5,OP125,Passed,ML-78542-01,45,1250,\"Standard production run\"\r\nPB00002,PRD10002,PL006,FAC002,2025-01-01,Morning,2650,45,07:00:00,15:00:00,9.1,OP238,Passed,ML-65432-01,60,1180,\"Minor material feed issues\"\r\n\r\nFile: analyze\/batch7051mu\/ProductionLine.csv\r\nLine_ID,Line_Name,Facility_ID,Product_Category,Primary_Product_ID,Secondary_Product_ID,Line_Type,Installation_Date,Max_Capacity_Units_Day,Current_Efficiency_Percentage,Shift_Pattern,Line_Manager,Last_Maintenance_Date,Next_Maintenance_Date,Downtime_Hours_MTD,OEE_Score,Quality_Rating,Status\r\nPL001,Oil Filter Line 1,FAC001,Oil Filters,PRD10001,PRD10002,Assembly,2018-05-12,3500,92.5,3 Shifts,James Wilson,2025-03-10,2025-06-10,12.5,85.3,A,Active\r\nPL002,Oil Filter Line 2,FAC001,Oil Filters,PRD10003,PRD10004,Heavy Duty,2019-08-23,2800,89.7,3 Shifts,Maria Rodriguez,2025-03-05,2025-06-05,18.2,82.1,A,Active\r\n\r\nFile: analyze\/batch7051mu\/Supplier.csv\r\nSupplier_ID,Company_Name,Material_Category,Primary_Material,Region,Country,Credit_Rating,Payment_Terms,Lead_Time_Days,Min_Order_Qty,Quality_Cert,Tax_ID,Currency,Status\r\nSPL100001,ThyssenKrupp AG,Steel,Carbon Steel,Europe,Germany,AA,Net 60,45,5000 KG,ISO 9001\/TS 16949,DE123456789,EUR,Active\r\nSPL100002,Gerdau Special Steel,Steel,Alloy Steel,Americas,USA,A+,Net 45,30,2000 KG,ISO 9001\/TS 16949,US234567890,USD,Active\r\n\r\nFile: analyze\/batch7051mu\/SupplierKPI.csv\r\nKPI_ID,Supplier_ID,Monthly_Order_Fill_Rate_%,Inventory_Turns,Cost_Savings_Initiatives_%,Quality_Incidents_YTD,Corrective_Actions_Open,Avg_Resolution_Time_Days,Sustainability_Score,Development_Projects,Contract_Compliance_%,Business_Continuity_Score\r\nKPI10001,SPL100001,98.5,12.3,4.2,3,1,5.2,85,4,97.8,92\r\nKPI10002,SPL100002,97.2,10.8,3.8,5,2,6.5,78,3,96.5,88\r\n\r\nFile: analyze\/batch7051mu\/WarrantyClaim.csv\r\nClaim_ID,Product_ID,Batch_ID,Customer_ID,Dealer_ID,Claim_Date,Installation_Date,Failure_Date,Claim_Status,Failure_Mode,Failure_Cause,Failure_Resolution,Part_Condition,Mileage_At_Failure,Vehicle_Make,Vehicle_Model,Vehicle_Year,VIN,Labor_Hours,Labor_Cost,Parts_Cost,Total_Claim_Amount,Technician_Notes,Quality_Review_Status,Claim_Approval_Date,Reimbursement_Date,Claim_Processing_Time_Days,Warranty_Coverage_Percentage,Return_Material_Authorization,Root_Cause_Analysis_Completed,Corrective_Action_Required,Customer_Satisfaction_Score\r\nWC10001,PRD10001,PB00001,CUST5432,DLR123,2025-03-15,2025-01-20,2025-03-10,Approved,Leakage,Manufacturing Defect,Replacement,Damaged,12500,Toyota,Camry,2024,1HGCM82633A123456,0.5,45.00,12.99,57.99,\"Oil filter showed signs of premature seal failure\",Passed,2025-03-20,2025-03-25,5,100,RMA10001,Yes,Yes,4\r\nWC10002,PRD10002,PB00002,CUST6754,DLR456,2025-04-02,2025-01-25,2025-03-30,Approved,Clogging,Material Defect,Replacement,Damaged,8750,Honda,Civic,2023,2HGES16523H789012,0.5,45.00,8.99,53.99,\"Filter media collapsed causing restricted oil flow\",Passed,2025-04-07,2025-04-10,5,100,RMA10002,Yes,Yes,5\r\n\r\n",
            "file_count": "12",
            "id": "5fab5b92-0452-48a9-8c83-b62ecb0fb210",
            "file_name": "analyze\/batch7051mu",
            "timestamp": "2025-05-16T04:18:02Z"
        },
        {
            "results": "File: sample_data\/csv\/BatchSupplier.csv\r\nBatchSupplier_ID,Batch_ID,Supplier_ID,Material_Lot_Number,Delivery_Date,Quality_Check_Status,On_Time_Delivery,Quantity_Received,Quantity_Accepted,Rejection_Rate,Payment_Terms,Invoice_Number,Payment_Status,Notes\nBS00001,PB00001,SPL100001,ML-78542-01-S1,2024-12-15,Passed,Yes,3500,3450,1.43,Net 60,INV-SPL100001-12345,Paid,\"Steel components for housing and threaded collar\"\nBS00002,PB00001,SPL100002,ML-78542-01-S2,2024-12-16,Passed,Yes,2800,2750,1.79,Net 45,INV-SPL100002-23456,Paid,\"Steel components for center tube and springs\"\nBS00003,PB00001,SPL100003,ML-78542-01-S3,2024-12-14,Passed,Yes,3200,3150,1.56,Net 60,INV-SPL100003-34567,Paid,\"Steel components for mesh and springs\"\nBS00004,PB00001,SPL100004,ML-78542-01-S4,2024-12-17,Passed,No,5800,5700,1.72,Net 30,INV-SPL100004-45678,Paid,\"Steel components for end plates\"\nBS00005,PB00001,SPL100006,ML-78542-01-S6,2024-12-15,Passed,Yes,3000,2950,1.67,Net 60,INV-SPL100006-56789,Paid,\"Rubber components for gaskets\"\nBS00006,PB00001,SPL100007,ML-78542-01-S7,2024-12-16,Passed,Yes,2900,2850,1.72,Net 45,INV-SPL100007-67890,Paid,\"Rubber components for valves\"\nBS00007,PB00001,SPL100008,ML-78542-01-S8,2024-12-14,Passed,Yes,5800,5700,1.72,Net 60,INV-SPL100008-78901,Paid,\"Rubber components for seals\"\nBS00008,PB00001,SPL100016,ML-78542-01-S16,2024-12-13,Passed,Yes,3000,2950,1.67,Net 45,INV-SPL100016-89012,Paid,\"Filter media components\"\nBS00009,PB00001,SPL100017,ML-78542-01-S17,2024-12-15,Passed,Yes,2900,2850,1.72,Net 30,INV-SPL100017-90123,Paid,\"Filter media components\"\nBS00010,PB00001,SPL100018,ML-78542-01-S18,2024-12-16,Passed,Yes,2950,2900,1.69,Net 45,INV-SPL100018-01234,Paid,\"Filter media components\"\nBS00011,PB00021,SPL100001,ML-23456-01-S1,2024-12-18,Passed,Yes,3450,3400,1.45,Net 60,INV-SPL100001-12346,Paid,\"Steel components for housing and threaded collar\"\nBS00012,PB00021,SPL100002,ML-23456-01-S2,2024-12-19,Passed,Yes,2750,2700,1.82,Net 45,INV-SPL100002-23457,Paid,\"Steel components for center tube and springs\"\nBS00013,PB00021,SPL100003,ML-23456-01-S3,2024-12-17,Passed,Yes,3150,3100,1.59,Net 60,INV-SPL100003-34568,Paid,\"Steel components for mesh and springs\"\nBS00014,PB00021,SPL100004,ML-23456-01-S4,2024-12-20,Passed,No,5750,5650,1.74,Net 30,INV-SPL100004-45679,Paid,\"Steel components for end plates\"\nBS00015,PB00021,SPL100006,ML-23456-01-S6,2024-12-18,Passed,Yes,2950,2900,1.69,Net 60,INV-SPL100006-56790,Paid,\"Rubber components for gaskets\"\nBS00016,PB00021,SPL100007,ML-23456-01-S7,2024-12-19,Passed,Yes,2850,2800,1.75,Net 45,INV-SPL100007-67891,Paid,\"Rubber components for valves\"\nBS00017,PB00021,SPL100008,ML-23456-01-S8,2024-12-17,Passed,Yes,5750,5650,1.74,Net 60,INV-SPL100008-78902,Paid,\"Rubber components for seals\"\nBS00018,PB00021,SPL100016,ML-23456-01-S16,2024-12-16,Passed,Yes,2950,2900,1.69,Net 45,INV-SPL100016-89013,Paid,\"Filter media components\"\nBS00019,PB00021,SPL100017,ML-23456-01-S17,2024-12-18,Passed,Yes,2850,2800,1.75,Net 30,INV-SPL100017-90124,Paid,\"Filter media components\"\nBS00020,PB00021,SPL100018,ML-23456-01-S18,2024-12-19,Passed,Yes,2900,2850,1.72,Net 45,INV-SPL100018-01235,Paid,\"Filter media components\"\r\n\r\nFile: sample_data\/csv\/EBOM.csv\r\nEBOM_ID,Batch_ID,Product_ID,Part_ID,Quantity_Per_Unit,Revision_Number,Effective_Date,Status,Engineering_Approval,Quality_Approval,Manufacturing_Approval,Notes\nEBOM10001,PB00001,PRD10001,PRT20001,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10002,PB00001,PRD10001,PRT20002,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10003,PB00001,PRD10001,PRT20003,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10004,PB00001,PRD10001,PRT20004,2,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10005,PB00001,PRD10001,PRT20005,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10006,PB00001,PRD10001,PRT20006,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10007,PB00001,PRD10001,PRT20007,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10008,PB00001,PRD10001,PRT20008,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10009,PB00001,PRD10001,PRT20009,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10010,PB00001,PRD10001,PRT20010,2,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10011,PB00001,PRD10001,PRT20011,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10012,PB00001,PRD10001,PRT20012,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10013,PB00001,PRD10001,PRT20013,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10014,PB00001,PRD10001,PRT20014,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10015,PB00001,PRD10001,PRT20015,1,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10016,PB00001,PRD10001,PRT20016,2,A,2024-12-15,Active,ENG123,QA456,MFG789,\"Standard design\"\nEBOM10017,PB00021,PRD10001,PRT20001,1,A,2024-12-15,Active,ENG124,QA457,MFG790,\"Secondary facility design\"\nEBOM10018,PB00021,PRD10001,PRT20002,1,A,2024-12-15,Active,ENG124,QA457,MFG790,\"Secondary facility design\"\nEBOM10019,PB00021,PRD10001,PRT20003,1,A,2024-12-15,Active,ENG124,QA457,MFG790,\"Secondary facility design\"\nEBOM10020,PB00021,PRD10001,PRT20004\r\n\r\nFile: sample_data\/csv\/Facility.csv\r\nFacility_ID,Facility_Name,Facility_Type,Address_Line1,Address_Line2,City,State,Zip_Code,Country,Phone_Number,Email,Square_Footage,Year_Built,Ownership_Type,Production_Capacity_Units_Day,Warehouse_Capacity_Pallets,Number_of_Loading_Docks,Number_of_Production_Lines,Number_of_Employees,Operating_Hours,Maintenance_Schedule,ISO_Certified,Last_Audit_Date,Energy_Consumption_kWh_Month,Water_Usage_Gallons_Month,Waste_Management_Vendor,Security_Level,Insurance_Policy_Number,Property_Tax_ID,Facility_Manager,Emergency_Contact,Latitude,Longitude\nFAC001,Detroit Manufacturing Center,Production,2122 Woodward Ave,,Detroit,MI,48201,USA,313-555-7890,detroit.ops@oai-auto.com,325000,1998,Owned,12500,8500,18,6,450,24\/7,Quarterly,Yes,2025-01-15,685000,420000,Waste Management Inc.,Level 3,POL-78542-DTM,DTX-45678-01,Michael Johnson,313-555-9012,42.3385,-83.0524\nFAC002,Cleveland Assembly Plant,Assembly,1265 Industrial Parkway,,Cleveland,OH,44135,USA,216-555-4321,cleveland.ops@oai-auto.com,275000,2005,Leased,9800,6200,14,5,380,24\/7,Bi-monthly,Yes,2025-02-10,580000,350000,Republic Services,Level 3,POL-65432-CLV,CTX-78901-02,Sarah Williams,216-555-6789,41.4374,-81.8459\nFAC003,Nashville Distribution Center,Distribution,1248 Antioch Pike,,Nashville,TN,37211,USA,615-555-8765,nashville.dist@oai-auto.com,185000,2010,Owned,0,12500,22,0,120,6am-10pm,Quarterly,Yes,2025-01-28,210000,85000,Waste Connections,Level 2,POL-98765-NSH,NTX-12345-03,Robert Chen,615-555-2345,36.0726,-86.7156\nFAC004,Phoenix Manufacturing Plant,Production,5005 E Washington St,,Phoenix,AZ,85034,USA,602-555-3456,phoenix.ops@oai-auto.com,290000,2012,Owned,11200,7800,16,5,410,24\/7,Quarterly,Yes,2025-03-05,720000,380000,Waste Management Inc.,Level 3,POL-34567-PHX,PTX-56789-04,Jennifer Garcia,602-555-7890,33.4484,-112.0740\nFAC005,Charlotte Technical Center,R&D,8600 McAlpine Park Dr,,Charlotte,NC,28211,USA,704-555-9012,charlotte.tech@oai-auto.com,120000,2015,Leased,1500,2000,6,3,180,8am-6pm,Monthly,Yes,2025-02-20,320000,110000,GFL Environmental,Level 4,POL-23456-CLT,CTX-89012-05,David Wilson,704-555-3456,35.1468,-80.8226\nFAC006,Indianapolis Parts Plant,Production,7225 E 10th St,,Indianapolis,IN,46219,USA,317-555-6789,indy.parts@oai-auto.com,210000,2001,Owned,8500,5500,12,4,290,24\/7,Quarterly,Yes,2025-01-08,490000,280000,Republic Services,Level 3,POL-87654-IND,ITX-34567-06,Amanda Taylor,317-555-0123,39.7795,-86.0187\nFAC007,Portland Logistics Hub,Distribution,2400 NW Front Ave,,Portland,OR,97209,USA,503-555-2345,portland.dist@oai-auto.com,165000,2018,Leased,0,10800,20,0,95,6am-10pm,Quarterly,Yes,2025-03-12,180000,70000,Waste Connections,Level 2,POL-45678-PDX,PTX-67890-07,Kevin Martinez,503-555-6789,45.5370,-122.7185\nFAC008,Austin Innovation Center,R&D,4616 W Howard Ln,,Austin,TX,78728,USA,512-555-7890,austin.tech@oai-auto.com,95000,2020,Leased,800,1200,4,2,150,8am-6pm,Monthly,Yes,2025-02-25,280000,90000,Texas Disposal Systems,Level 4,POL-12345-AUS,ATX-90123-08,Michelle Lee,512-555-2345,30.4316,-97.6788\nFAC009,Pittsburgh Manufacturing Complex,Production,300 Corliss St,,Pittsburgh,PA,15220,USA,412-555-4567,pittsburgh.ops@oai-auto.com,305000,1995,Owned,10500,7200,15,5,420,24\/7,Quarterly,Yes,2025-01-20,650000,390000,Waste Management Inc.,Level 3,POL-56789-PIT,PTX-12345-09,Christopher Brown,412-555-8901,40.4467,-80.0326\nFAC010,Denver Distribution Center,Distribution,5555 E 58th Ave,,Denver,CO,80216,USA,303-555-0123,denver.dist@oai-auto.com,175000,2014,Owned,0,11500,21,0,110,6am-10pm,Quarterly,Yes,2025-03-18,195000,75000,GFL Environmental,Level 2,POL-67890-DEN,DTX-45678-10,Stephanie Rodriguez,303-555-4567,39.8027,-104.9418\n\r\n\r\nFile: sample_data\/csv\/LineConfiguration.csv\r\nConfig_ID,Line_ID,Machine_ID,Sequence_Number,Setup_Time_Minutes,Changeover_Time_Minutes,Bottleneck_Status,Last_Calibration_Date,Next_Calibration_Date,Operator_Skill_Level_Required,Maintenance_Priority\nLC001,PL001,MCH001,1,45,90,No,2025-02-05,2025-05-05,3,Medium\nLC002,PL001,MCH002,2,30,60,No,2025-02-10,2025-05-10,3,Medium\nLC003,PL001,MCH003,3,40,75,Yes,2025-02-15,2025-05-15,4,High\nLC004,PL001,MCH004,4,25,45,No,2025-02-20,2025-05-20,2,Low\nLC005,PL001,MCH005,5,35,65,No,2025-02-25,2025-05-25,3,Medium\nLC006,PL001,MCH006,6,20,30,No,2025-03-01,2025-06-01,3,Medium\nLC007,PL001,MCH007,7,30,50,No,2025-03-05,2025-06-05,2,Low\nLC008,PL002,MCH035,1,50,95,No,2025-03-08,2025-06-08,4,High\nLC009,PL002,MCH036,2,35,65,No,2025-03-12,2025-06-12,3,Medium\nLC010,PL002,MCH037,3,45,80,Yes,2025-03-15,2025-06-15,4,High\nLC011,PL002,MCH004,4,25,45,No,2025-03-18,2025-06-18,2,Low\nLC012,PL002,MCH005,5,35,65,No,2025-03-20,2025-06-20,3,Medium\nLC013,PL003,MCH008,1,55,100,No,2025-01-15,2025-04-15,4,High\nLC014,PL003,MCH009,2,60,110,Yes,2025-01-20,2025-04-20,4,High\nLC015,PL003,MCH010,3,45,85,No,2025-01-25,2025-04-25,3,Medium\nLC016,PL003,MCH011,4,65,120,No,2025-02-01,2025-05-01,4,High\nLC017,PL003,MCH012,5,50,90,No,2025-02-05,2025-05-05,3,Medium\nLC018,PL004,MCH038,1,60,105,No,2025-02-15,2025-05-15,4,High\nLC019,PL004,MCH039,2,65,115,Yes,2025-02-20,2025-05-20,4,High\nLC020,PL004,MCH040,3,50,90,No,2025-02-25,2025-05-25,3,Medium\r\n\r\nFile: sample_data\/csv\/Machine.csv\r\nMachine_ID,Machine_Name,Machine_Type,Manufacturer,Model_Number,Serial_Number,Installation_Date,Last_Maintenance_Date,Next_Maintenance_Date,Machine_Status,Max_Capacity_Units_Hour,Current_Efficiency_Percentage,Power_Consumption_kWh,Warranty_Expiration_Date,Purchase_Cost,Maintenance_Cost_Annual,Expected_Lifespan_Years,Software_Version,Control_System_Type,Product_Category\nMCH001,Steel Stamping Press,Stamping,Schuler Group,SP-5000,SP5K-78542,2018-03-15,2025-02-10,2025-05-10,Active,450,92.5,75,2028-03-15,285000,12500,15,v3.2.1,Siemens S7-1500,Oil Filters\nMCH002,Filter Housing Welder,Welding,FANUC,FW-2200,FW22-65432,2018-04-20,2025-02-15,2025-05-15,Active,380,94.3,65,2028-04-20,210000,9800,12,v4.1.0,FANUC R-30iB,Oil Filters\nMCH003,Media Pleating Machine,Pleating,Grob Systems,PM-1500,PM15-98765,2018-05-05,2025-02-20,2025-05-20,Active,520,91.8,55,2028-05-05,175000,8200,10,v2.8.5,Allen-Bradley ControlLogix,Oil Filters\nMCH004,Adhesive Dispenser,Dispensing,Nordson,AD-800,AD8-34567,2018-05-25,2025-02-25,2025-05-25,Active,600,93.5,40,2028-05-25,120000,5500,8,v5.3.2,Nordson ProBlue,Oil Filters\nMCH005,End Cap Assembly,Assembly,Bosch Rexroth,ECA-3000,ECA3-23456,2018-06-10,2025-03-01,2025-06-01,Active,480,95.2,50,2028-06-10,195000,7800,12,v3.7.0,Bosch IndraMotion,Oil Filters\nMCH006,Quality Testing Station,Testing,Keyence,QTS-1000,QTS1-87654,2018-06-25,2025-03-05,2025-06-05,Active,720,96.5,35,2028-06-25,145000,6200,15,v6.2.1,Keyence CV-X Series,Oil Filters\nMCH007,Packaging System,Packaging,Krones,PKG-2500,PKG25-45678,2018-07-10,2025-03-10,2025-06-10,Active,850,94.8,45,2028-07-10,165000,7100,10,v4.5.3,Siemens SIMATIC,Oil Filters\nMCH008,Steel Backing Plate Press,Stamping,Schuler Group,BP-4000,BP4K-12345,2019-02-15,2025-01-20,2025-04-20,Active,320,93.2,80,2029-02-15,310000,13500,15,v3.2.1,Siemens S7-1500,Brake Pads\nMCH009,Friction Material Mixer,Mixing,B\u00FChler Group,FMM-1800,FMM18-67890,2019-03-10,2025-01-25,2025-04-25,Active,250,91.5,95,2029-03-10,340000,15200,12,v2.9.4,Allen-Bradley CompactLogix,Brake Pads\nMCH010,Friction Material Applicator,Application,Nordson,FMA-2200,FMA22-90123,2019-03-25,2025-02-01,2025-05-01,Active,280,92.8,85,2029-03-25,295000,13800,10,v5.3.2,Nordson ProBlue,Brake Pads\nMCH011,Heat Curing Oven,Curing,Despatch Industries,HCO-3500,HCO35-56789,2019-04-15,2025-02-05,2025-05-05,Active,300,94.5,120,2029-04-15,385000,16500,15,v4.0.1,Honeywell HC900,Brake Pads\nMCH012,Grinding Machine,Grinding,Okuma,GM-1500,GM15-01234,2019-05-01,2025-02-10,2025-05-10,Active,270,93.7,90,2029-05-01,320000,14200,12,v3.5.2,FANUC 31i-B,Brake Pads\nMCH013,Brake Pad Slotter,Slotting,DMG MORI,BPS-1000,BPS1-78901,2019-05-15,2025-02-15,2025-05-15,Active,350,95.1,75,2029-05-15,275000,12500,10,v4.2.0,Siemens SINUMERIK,Brake Pads\nMCH014,Quality Testing Station,Testing,Keyence,QTS-1000,QTS1-23456,2019-06-01,2025-02-20,2025-05-20,Active,720,96.5,35,2029-06-01,145000,6200,15,v6.2.1,Keyence CV-X Series,Brake Pads\nMCH015,Packaging System,Packaging,Krones,PKG-2500,PKG25-89012,2019-06-15,2025-02-25,2025-05-25,Active,850,94.8,45,2029-06-15,165000,7100,10,v4.5.3,Siemens SIMATIC,Brake Pads\nMCH016,Frame Injection Molder,Molding,Engel,FIM-3000,FIM3-34567,2019-08-10,2025-01-15,2025-04-15,Active,220,92.3,110,2029-08-10,420000,18500,15,v3.8.2,Engel CC300,Air Filters\nMCH017,Media Pleating Machine,Pleating,Grob Systems,PM-1500,PM15-90123,2019-08-25,2025-01-20,2025-04-20,Active,520,91.8,55,2029-08-25,175000,8200,10,v2.8.5,Allen-Bradley ControlLogix,Air Filters\nMCH018,Media Cutting System,Cutting,Trumpf,MCS-2000,MCS2-56789,2019-09-10,2025-01-25,2025-04-25,Active,480,93.5,65,2029-09-10,230000,10500,12,v4.1.3,Trumpf TruControl,Air Filters\nMCH019,Ultrasonic Welding Machine,Welding,Branson,UWM-1200,UWM12-01234,2019-09-25,2025-02-01,2025-05-01,Active,350,94.2,70,2029-09-25,250000,11200,10,v5.0.1,Branson DCX,Air Filters\nMCH020,Quality Testing Station,Testing,Keyence,QTS-1000,QTS1-67890,2019-10-10,2025-02-05,2025-05-05,Active,720,96.5,35,2029-10-10,145000,6200,15,v6.2.1,Keyence CV-X Series,Air Filters\r\n\r\nFile: sample_data\/csv\/Part.csv\r\nPart_ID,Part_Name,Part_Category,Product_ID,Material_Type,Supplier_ID,Unit_Cost,Min_Stock_Level,Lead_Time_Days,Status\nPRT20001,Steel Housing Canister,Metal Components,PRD10001,Steel,SPL100001,2.50,200,30,Active\nPRT20002,Steel Center Tube,Metal Components,PRD10001,Steel,SPL100002,1.20,300,25,Active\nPRT20003,Steel Support Mesh,Metal Components,PRD10001,Steel,SPL100003,0.85,400,20,Active\nPRT20004,Steel End Plates,Metal Components,PRD10001,Steel,SPL100004,1.10,250,15,Active\nPRT20005,Steel Threaded Collar,Metal Components,PRD10001,Steel,SPL100001,0.95,300,30,Active\nPRT20006,Steel Relief Valve Spring,Metal Components,PRD10001,Steel,SPL100002,0.45,500,25,Active\nPRT20007,Steel Bypass Valve Spring,Metal Components,PRD10001,Steel,SPL100003,0.40,500,20,Active\nPRT20008,Nitrile Rubber Base Gasket,Rubber Components,PRD10001,Rubber,SPL100006,0.35,600,15,Active\nPRT20009,Nitrile Rubber Anti-Drainback Valve,Rubber Components,PRD10001,Rubber,SPL100007,0.65,400,20,Active\nPRT20010,Rubber End Disc Seals,Rubber Components,PRD10001,Rubber,SPL100008,0.30,700,15,Active\nPRT20011,Cellulose Synthetic Blend Media,Filter Media,PRD10001,Filter Media,SPL100016,1.75,200,30,Active\nPRT20012,Spiral Wound Outer Wrap,Filter Media,PRD10001,Filter Media,SPL100017,0.90,300,25,Active\nPRT20013,Support Media Layer,Filter Media,PRD10001,Filter Media,SPL100018,0.80,350,20,Active\nPRT20014,Metal Bypass Valve Assembly,Hardware,PRD10001,Metal,SPL100001,1.25,200,30,Active\nPRT20015,Metal Relief Valve Assembly,Hardware,PRD10001,Metal,SPL100002,1.30,200,25,Active\nPRT20016,End Cap Assembly,Hardware,PRD10001,Metal,SPL100003,0.95,250,20,Active\nPRT20017,Low Carbon Steel Backing Plate,Metal Components,PRD10005,Steel,SPL100001,3.75,150,30,Active\nPRT20018,Steel Attachment Clips,Metal Components,PRD10005,Steel,SPL100002,0.85,400,25,Active\nPRT20019,Steel Wear Indicators,Metal Components,PRD10005,Steel,SPL100003,0.95,350,20,Active\nPRT20020,Steel Mesh Shims,Metal Components,PRD10005,Steel,SPL100004,1.15,300,15,Active\r\n\r\nFile: sample_data\/csv\/Product.csv\r\nProduct_ID,Product_Name,Product_Category,Description,Base_Price,Warranty_Period_Months,Min_Order_Qty,Lead_Time_Days,Status\nPRD10001,Premium Oil Filter,Oil Filters,High-performance oil filter with extended service life,12.99,12,50,14,Active\nPRD10002,Economy Oil Filter,Oil Filters,Cost-effective oil filter for standard maintenance,8.99,6,100,10,Active\nPRD10003,Heavy Duty Oil Filter,Oil Filters,Reinforced oil filter for commercial and heavy-duty applications,19.99,18,25,21,Active\nPRD10004,Racing Oil Filter,Oil Filters,High-flow oil filter designed for performance vehicles,24.99,12,20,30,Active\nPRD10005,Ceramic Brake Pads,Brake Pads,Premium ceramic brake pads with low dust and noise,49.99,24,20,14,Active\nPRD10006,Semi-Metallic Brake Pads,Brake Pads,Durable semi-metallic brake pads for everyday driving,39.99,18,30,10,Active\nPRD10007,Performance Brake Pads,Brake Pads,High-performance brake pads for sport and racing applications,69.99,12,15,21,Active\nPRD10008,Commercial Brake Pads,Brake Pads,Heavy-duty brake pads for commercial vehicles,59.99,24,10,30,Active\nPRD10009,Standard Air Filter,Air Filters,Regular replacement air filter for passenger vehicles,14.99,12,40,7,Active\nPRD10010,High-Flow Air Filter,Air Filters,Performance air filter with increased airflow,29.99,24,25,14,Active\nPRD10011,Heavy Duty Air Filter,Air Filters,Reinforced air filter for trucks and commercial vehicles,24.99,18,20,21,Active\nPRD10012,Washable Air Filter,Air Filters,Reusable air filter that can be cleaned and reinstalled,39.99,36,15,14,Active\nPRD10013,Standard Cabin Filter,Cabin Filters,Basic cabin air filter for dust and pollen filtration,19.99,12,30,7,Active\nPRD10014,HEPA Cabin Filter,Cabin Filters,Advanced HEPA cabin filter for superior air quality,29.99,12,20,14,Active\nPRD10015,Carbon Cabin Filter,Cabin Filters,Activated carbon cabin filter for odor elimination,34.99,12,20,14,Active\nPRD10016,Hypoallergenic Cabin Filter,Cabin Filters,Specialized cabin filter for allergy sufferers,39.99,12,15,21,Active\nPRD10017,Standard Alternator,Alternators,OEM replacement alternator for passenger vehicles,129.99,24,10,21,Active\nPRD10018,High-Output Alternator,Alternators,Performance alternator with increased amperage output,199.99,18,5,30,Active\nPRD10019,Heavy Duty Alternator,Alternators,Reinforced alternator for commercial and fleet vehicles,249.99,36,5,30,Active\nPRD10020,Compact Alternator,Alternators,Space-saving alternator design for limited engine compartments,159.99,24,8,21,Active\r\n\r\nFile: sample_data\/csv\/ProductionBatch.csv\r\nBatch_ID,Product_ID,Line_ID,Facility_ID,Production_Date,Shift,Quantity_Produced,Quantity_Rejected,Start_Time,End_Time,Cycle_Time_Seconds,Operator_ID,Quality_Check_Status,Material_Lot_Number,Downtime_Minutes,Energy_Consumption_kWh,Notes\nPB00001,PRD10001,PL001,FAC001,2025-01-01,Morning,2850,32,07:00:00,15:00:00,8.5,OP125,Passed,ML-78542-01,45,1250,\"Standard production run\"\nPB00002,PRD10002,PL006,FAC002,2025-01-01,Morning,2650,45,07:00:00,15:00:00,9.1,OP238,Passed,ML-65432-01,60,1180,\"Minor material feed issues\"\nPB00003,PRD10003,PL011,FAC004,2025-01-01,Morning,2450,28,07:00:00,15:00:00,9.8,OP312,Passed,ML-98765-01,30,1320,\"Smooth production run\"\nPB00004,PRD10004,PL020,FAC009,2025-01-01,Morning,1950,22,07:00:00,15:00:00,12.3,OP427,Passed,ML-34567-01,25,1380,\"High efficiency run\"\nPB00005,PRD10005,PL003,FAC001,2025-01-01,Morning,1750,18,07:00:00,15:00:00,13.7,OP156,Passed,ML-23456-01,35,1420,\"Quality above target\"\nPB00006,PRD10006,PL007,FAC002,2025-01-01,Morning,1650,25,07:00:00,15:00:00,14.5,OP241,Passed,ML-87654-01,40,1350,\"Standard production run\"\nPB00007,PRD10007,PL013,FAC004,2025-01-01,Morning,1450,15,07:00:00,15:00:00,16.6,OP318,Passed,ML-45678-01,20,1480,\"Premium product run\"\nPB00008,PRD10008,PL022,FAC009,2025-01-01,Morning,1250,14,07:00:00,15:00:00,19.2,OP431,Passed,ML-01234-01,15,1520,\"Commercial grade production\"\nPB00009,PRD10009,PL005,FAC001,2025-01-01,Morning,1850,21,07:00:00,15:00:00,13.0,OP162,Passed,ML-67890-01,30,1280,\"Standard production run\"\nPB00010,PRD10010,PL014,FAC004,2025-01-01,Morning,1650,19,07:00:00,15:00:00,14.5,OP324,Passed,ML-12345-01,25,1350,\"High-flow variant production\"\nPB00011,PRD10011,PL008,FAC002,2025-01-01,Morning,1550,17,07:00:00,15:00:00,15.5,OP245,Passed,ML-89012-01,35,1380,\"Heavy duty variant production\"\nPB00012,PRD10012,PL018,FAC006,2025-01-01,Morning,1350,12,07:00:00,15:00:00,17.8,OP352,Passed,ML-56789-01,20,1320,\"Washable filter production\"\nPB00013,PRD10013,PL009,FAC002,2025-01-01,Morning,1750,23,07:00:00,15:00:00,13.7,OP248,Passed,ML-90123-01,40,1250,\"Standard cabin filter run\"\nPB00014,PRD10014,PL024,FAC009,2025-01-01,Morning,1550,16,07:00:00,15:00:00,15.5,OP435,Passed,ML-67890-01,30,1320,\"HEPA grade production\"\nPB00015,PRD10015,PL015,FAC004,2025-01-01,Morning,1450,15,07:00:00,15:00:00,16.6,OP328,Passed,ML-34567-01,25,1380,\"Carbon filter production\"\nPB00016,PRD10016,PL015,FAC004,2025-01-01,Afternoon,1400,18,15:00:00,23:00:00,17.1,OP329,Passed,ML-34567-01,35,1390,\"Hypoallergenic variant production\"\nPB00017,PRD10017,PL010,FAC002,2025-01-01,Morning,1250,8,07:00:00,15:00:00,19.2,OP252,Passed,ML-12345-01,45,1650,\"Standard alternator production\"\nPB00018,PRD10018,PL010,FAC002,2025-01-01,Afternoon,1150,7,15:00:00,23:00:00,20.9,OP253,Passed,ML-12345-01,40,1720,\"High-output alternator production\"\nPB00019,PRD10019,PL019,FAC006,2025-01-01,Morning,1050,6,07:00:00,15:00:00,22.9,OP356,Passed,ML-78901-01,30,1780,\"Heavy duty alternator production\"\nPB00020,PRD10020,PL019,FAC006,2025-01-01,Afternoon,1100,9,15:00:00,23:00:00,21.8,OP357,Passed,ML-78901-01,35,1750,\"Compact alternator production\"\r\n\r\nFile: sample_data\/csv\/ProductionLine.csv\r\nLine_ID,Line_Name,Facility_ID,Product_Category,Primary_Product_ID,Secondary_Product_ID,Line_Type,Installation_Date,Max_Capacity_Units_Day,Current_Efficiency_Percentage,Shift_Pattern,Line_Manager,Last_Maintenance_Date,Next_Maintenance_Date,Downtime_Hours_MTD,OEE_Score,Quality_Rating,Status\nPL001,Oil Filter Line 1,FAC001,Oil Filters,PRD10001,PRD10002,Assembly,2018-05-12,3500,92.5,3 Shifts,James Wilson,2025-03-10,2025-06-10,12.5,85.3,A,Active\nPL002,Oil Filter Line 2,FAC001,Oil Filters,PRD10003,PRD10004,Heavy Duty,2019-08-23,2800,89.7,3 Shifts,Maria Rodriguez,2025-03-05,2025-06-05,18.2,82.1,A,Active\nPL003,Brake Pad Line 1,FAC001,Brake Pads,PRD10005,PRD10006,Precision,2020-02-15,2200,94.2,3 Shifts,Thomas Lee,2025-03-15,2025-06-15,8.7,88.9,A+,Active\nPL004,Brake Pad Line 2,FAC001,Brake Pads,PRD10007,PRD10008,Performance,2020-06-30,1800,91.8,3 Shifts,Sophia Chen,2025-02-28,2025-05-28,14.3,84.5,A,Active\nPL005,Air Filter Line,FAC001,Air Filters,PRD10009,PRD10010,Standard,2019-11-05,2200,90.5,3 Shifts,Daniel Martinez,2025-03-20,2025-06-20,15.8,83.2,A-,Active\nPL006,Oil Filter Line 3,FAC002,Oil Filters,PRD10001,PRD10002,Assembly,2017-09-18,3200,88.3,3 Shifts,Emily Johnson,2025-02-15,2025-04-15,22.4,80.7,B+,Active\nPL007,Brake Pad Line 3,FAC002,Brake Pads,PRD10005,PRD10006,Precision,2018-11-12,2000,93.1,3 Shifts,Michael Brown,2025-02-20,2025-04-20,10.2,86.5,A,Active\nPL008,Air Filter Line 2,FAC002,Air Filters,PRD10011,PRD10012,Heavy Duty,2019-03-25,1900,89.8,3 Shifts,Jessica Taylor,2025-03-01,2025-05-01,16.7,82.3,A-,Active\nPL009,Cabin Filter Line 1,FAC002,Cabin Filters,PRD10013,PRD10014,Standard,2020-01-10,2100,92.4,3 Shifts,David Garcia,2025-02-25,2025-04-25,12.1,85.8,A,Active\nPL010,Alternator Line 1,FAC002,Alternators,PRD10017,PRD10018,Standard,2020-08-05,1500,95.2,3 Shifts,Sarah Williams,2025-03-08,2025-05-08,7.5,89.6,A+,Active\nPL025,R&D Test Line 1,FAC003,Oil Filters,PRD10001,PRD10004,R&D,2020-05-15,500,85.0,1 Shift,Robert Chen,2025-01-20,2025-04-20,5.2,78.5,B+,Active\nPL026,R&D Test Line 2,FAC003,Brake Pads,PRD10005,PRD10008,R&D,2020-06-20,400,86.5,1 Shift,Lisa Thompson,2025-01-25,2025-04-25,4.8,79.2,B+,Active\nPL011,Oil Filter Line 4,FAC004,Oil Filters,PRD10003,PRD10004,Heavy Duty,2018-07-20,3000,91.2,3 Shifts,Robert Thompson,2025-03-12,2025-06-12,14.8,84.9,A,Active\nPL012,Oil Filter Line 5,FAC004,Oil Filters,PRD10001,PRD10002,Assembly,2019-05-15,3300,90.5,3 Shifts,Jennifer Garcia,2025-03-18,2025-06-18,15.3,83.7,A-,Active\nPL013,Brake Pad Line 4,FAC004,Brake Pads,PRD10007,PRD10008,Performance,2020-03-10,2100,93.8,3 Shifts,Christopher Davis,2025-03-02,2025-06-02,9.6,87.4,A,Active\nPL014,Air Filter Line 3,FAC004,Air Filters,PRD10009,PRD10010,Standard,2019-10-08,2300,89.7,3 Shifts,Amanda Wilson,2025-02-25,2025-05-25,17.2,82.1,B+,Active\nPL015,Cabin Filter Line 2,FAC004,Cabin Filters,PRD10015,PRD10016,Specialty,2020-04-22,1800,94.5,3 Shifts,Kevin Martinez,2025-03-15,2025-06-15,8.3,88.2,A+,Active\nPL027,Prototype Line 1,FAC005,Air Filters,PRD10009,PRD10012,R&D,2019-08-15,600,87.2,1 Shift,David Wilson,2025-02-15,2025-05-15,6.5,80.1,B+,Active\nPL028,Prototype Line 2,FAC005,Cabin Filters,PRD10013,PRD10016,R&D,2019-09-20,550,88.5,1 Shift,Rachel Adams,2025-02-20,2025-05-20,5.8,81.3,B+,Active\nPL029,Prototype Line 3,FAC005,Alternators,PRD10017,PRD10020,R&D,2019-10-25,400,89.0,1 Shift,Mark Johnson,2025-02-25,2025-05-25,5.2,82.0,A-,Active\r\n\r\nFile: sample_data\/csv\/Supplier.csv\r\nSupplier_ID,Company_Name,Material_Category,Primary_Material,Region,Country,Credit_Rating,Payment_Terms,Lead_Time_Days,Min_Order_Qty,Quality_Cert,Tax_ID,Currency,Status\nSPL100001,ThyssenKrupp AG,Steel,Carbon Steel,Europe,Germany,AA,Net 60,45,5000 KG,ISO 9001\/TS 16949,DE123456789,EUR,Active\nSPL100002,Gerdau Special Steel,Steel,Alloy Steel,Americas,USA,A+,Net 45,30,2000 KG,ISO 9001\/TS 16949,US234567890,USD,Active\nSPL100003,POSCO,Steel,Stainless Steel,Asia,South Korea,AA-,Net 60,40,3000 KG,ISO 9001\/TS 16949,KR345678901,USD,Active\nSPL100004,Ternium,Steel,Carbon Steel,Americas,Mexico,BBB+,Net 30,35,2500 KG,ISO 9001,MX456789012,USD,Active\nSPL100005,Tata Steel,Steel,Various Steel,Asia,India,BBB,Net 45,50,4000 KG,ISO 9001\/TS 16949,IN567890123,USD,Active\nSPL100006,DuPont,Rubber,Synthetic Rubber,Americas,USA,AA,Net 60,30,1000 KG,ISO 9001\/TS 16949,US678901234,USD,Active\nSPL100007,Freudenberg Group,Rubber,Natural Rubber,Europe,Germany,A+,Net 45,35,800 KG,ISO 9001\/TS 16949,DE789012345,EUR,Active\nSPL100008,Sumitomo Rubber,Rubber,Various Rubber,Asia,Japan,A,Net 60,40,1200 KG,ISO 9001\/TS 16949,JP890123456,JPY,Active\nSPL100009,Industrias PKS,Rubber,Synthetic Rubber,Americas,Brazil,BBB,Net 30,45,1500 KG,ISO 9001,BR901234567,BRL,Active\nSPL100010,NOK Corporation,Rubber,Specialized Rubber,Asia,Japan,A+,Net 45,35,1000 KG,ISO 9001\/TS 16949,JP012345678,JPY,Active\nSPL100011,BASF SE,Plastics,Polypropylene,Europe,Germany,AA+,Net 60,30,2000 KG,ISO 9001\/TS 16949,DE123456780,EUR,Active\nSPL100012,Dow Chemical,Plastics,Polyethylene,Americas,USA,AA,Net 45,25,1500 KG,ISO 9001\/TS 16949,US234567891,USD,Active\nSPL100013,LG Chem,Plastics,Various Polymers,Asia,South Korea,A+,Net 60,35,2500 KG,ISO 9001\/TS 16949,KR345678902,USD,Active\nSPL100014,Braskem,Plastics,Polyethylene,Americas,Brazil,BBB+,Net 30,40,3000 KG,ISO 9001,BR456789013,BRL,Active\nSPL100015,Reliance Industries,Plastics,Various Polymers,Asia,India,BBB,Net 45,45,2000 KG,ISO 9001,IN567890124,USD,Active\nSPL100016,Ahlstrom-Munksj\u00F6,Filter Media,Cellulose Media,Europe,Finland,A+,Net 45,40,500 KG,ISO 9001\/TS 16949,FI678901235,EUR,Active\nSPL100017,Hollingsworth & Vose,Filter Media,Synthetic Media,Americas,USA,A,Net 60,35,400 KG,ISO 9001\/TS 16949,US789012346,USD,Active\nSPL100018,Toyobo,Filter Media,Various Media,Asia,Japan,A,Net 45,45,600 KG,ISO 9001\/TS 16949,JP890123457,JPY,Active\nSPL100019,Fiberweb Brazil,Filter Media,Nonwoven Media,Americas,Brazil,BBB,Net 30,50,800 KG,ISO 9001,BR901234568,BRL,Active\nSPL100020,KNH Enterprise,Filter Media,Synthetic Media,Asia,Taiwan,BBB+,Net 45,40,500 KG,ISO 9001,TW012345679,USD,Active\r\n\r\nFile: sample_data\/csv\/SupplierKPI.csv\r\nKPI_ID,Supplier_ID,Monthly_Order_Fill_Rate_%,Inventory_Turns,Cost_Savings_Initiatives_%,Quality_Incidents_YTD,Corrective_Actions_Open,Avg_Resolution_Time_Days,Sustainability_Score,Development_Projects,Contract_Compliance_%,Business_Continuity_Score\nKPI10001,SPL100001,98.5,12.3,4.2,3,1,5.2,85,4,97.8,92\nKPI10002,SPL100002,97.2,10.8,3.8,5,2,6.5,78,3,96.5,88\nKPI10003,SPL100003,99.1,11.5,5.0,2,0,4.8,90,5,98.2,94\nKPI10004,SPL100004,95.8,9.7,3.2,7,3,8.1,72,2,94.3,82\nKPI10005,SPL100005,96.3,10.2,3.5,6,2,7.5,75,3,95.1,85\nKPI10006,SPL100006,98.9,11.8,4.8,2,1,5.0,88,4,97.5,91\nKPI10007,SPL100007,97.5,10.5,4.0,4,1,6.2,80,3,96.8,87\nKPI10008,SPL100008,98.2,11.0,4.5,3,1,5.5,83,4,97.0,89\nKPI10009,SPL100009,94.5,8.9,2.8,8,4,9.2,68,2,93.5,79\nKPI10010,SPL100010,97.8,10.7,4.2,4,2,6.8,79,3,96.2,86\nKPI10011,SPL100011,99.3,12.5,5.2,1,0,4.5,92,5,98.5,95\nKPI10012,SPL100012,98.0,11.2,4.6,3,1,5.8,84,4,97.2,90\nKPI10013,SPL100013,97.0,10.3,3.9,5,2,7.0,77,3,95.8,84\nKPI10014,SPL100014,95.2,9.1,3.0,7,3,8.5,70,2,94.0,80\nKPI10015,SPL100015,96.5,9.8,3.6,6,2,7.8,74,3,95.5,83\nKPI10016,SPL100016,98.7,11.9,4.9,2,0,4.9,89,5,97.9,93\nKPI10017,SPL100017,97.3,10.6,4.1,4,1,6.3,81,3,96.6,88\nKPI10018,SPL100018,98.0,11.1,4.4,3,1,5.6,82,4,97.1,89\nKPI10019,SPL100019,94.8,9.0,2.9,8,3,9.0,69,2,93.8,80\nKPI10020,SPL100020,97.6,10.4,4.0,4,2,6.9,78,3,96.0,85\r\n\r\nFile: sample_data\/csv\/WarrantyClaim.csv\r\nClaim_ID,Product_ID,Batch_ID,Customer_ID,Dealer_ID,Claim_Date,Installation_Date,Failure_Date,Claim_Status,Failure_Mode,Failure_Cause,Failure_Resolution,Part_Condition,Mileage_At_Failure,Vehicle_Make,Vehicle_Model,Vehicle_Year,VIN,Labor_Hours,Labor_Cost,Parts_Cost,Total_Claim_Amount,Technician_Notes,Quality_Review_Status,Claim_Approval_Date,Reimbursement_Date,Claim_Processing_Time_Days,Warranty_Coverage_Percentage,Return_Material_Authorization,Root_Cause_Analysis_Completed,Corrective_Action_Required,Customer_Satisfaction_Score\nWC10001,PRD10001,PB00001,CUST5432,DLR123,2025-03-15,2025-01-20,2025-03-10,Approved,Leakage,Manufacturing Defect,Replacement,Damaged,12500,Toyota,Camry,2024,1HGCM82633A123456,0.5,45.00,12.99,57.99,\"Oil filter showed signs of premature seal failure\",Passed,2025-03-20,2025-03-25,5,100,RMA10001,Yes,Yes,4\nWC10002,PRD10002,PB00002,CUST6754,DLR456,2025-04-02,2025-01-25,2025-03-30,Approved,Clogging,Material Defect,Replacement,Damaged,8750,Honda,Civic,2023,2HGES16523H789012,0.5,45.00,8.99,53.99,\"Filter media collapsed causing restricted oil flow\",Passed,2025-04-07,2025-04-10,5,100,RMA10002,Yes,Yes,5\nWC10003,PRD10003,PB00003,CUST7865,DLR789,2025-05-10,2025-02-05,2025-05-05,Pending,Structural Failure,Under Investigation,Pending,Damaged,35000,Ford,F-150,2024,1FTEW1EP5MFA34567,0.75,67.50,19.99,87.49,\"Heavy duty filter housing cracked during normal operation\",In Review,,,3,100,RMA10003,No,Pending,\nWC10004,PRD10004,PB00004,CUST8976,DLR234,2025-03-25,2025-01-30,2025-03-20,Rejected,Performance Issue,User Error,None,Intact,5000,Subaru,WRX,2025,JF1VA2M69G9890123,0,0.00,0.00,0.00,\"Filter installed incorrectly causing oil starvation\",Failed,2025-03-30,,5,0,RMA10004,Yes,No,2\nWC10005,PRD10001,PB00001,CUST2345,DLR567,2025-04-15,2025-02-10,2025-04-10,Approved,Gasket Failure,Manufacturing Defect,Replacement,Damaged,15750,Chevrolet,Malibu,2023,1G1ZD5ST4JF456789,0.5,45.00,12.99,57.99,\"Oil filter gasket deteriorated prematurely\",Passed,2025-04-20,2025-04-25,5,100,RMA10005,Yes,Yes,5\nWC10006,PRD10002,PB00002,CUST3456,DLR890,2025-05-05,2025-02-15,2025-05-01,Approved,Bypass Valve Failure,Design Flaw,Replacement,Damaged,12300,Nissan,Altima,2024,1N4BL4EV7KC567890,0.5,45.00,8.99,53.99,\"Bypass valve stuck in open position\",Passed,2025-05-10,2025-05-15,5,100,RMA10006,Yes,Yes,4\nWC10007,PRD10003,PB00003,CUST4567,DLR345,2025-06-20,2025-02-20,2025-06-15,Pending,Thread Stripping,Manufacturing Defect,Pending,Damaged,28500,GMC,Sierra,2023,3GTU2NEC4PG678901,1.5,135.00,19.99,154.99,\"Filter threads stripped during normal maintenance\",In Review,,,5,100,RMA10007,No,Pending,\nWC10008,PRD10004,PB00004,CUST5678,DLR678,2025-04-30,2025-03-01,2025-04-25,Approved,Seal Failure,Material Defect,Replacement,Damaged,7500,Mazda,MX-5,2024,JM1NDAD70F0789012,0.75,67.50,24.99,92.49,\"High-temperature seal failure during track use\",Passed,2025-05-05,2025-05-10,5,75,RMA10008,Yes,Yes,3\nWC10009,PRD10001,PB00001,CUST6789,DLR901,2025-05-25,2025-03-10,2025-05-20,Approved,Media Separation,Manufacturing Defect,Replacement,Damaged,18900,Kia,Optima,2025,5XXGT4L37KG890123,0.5,45.00,12.99,57.99,\"Filter media separated from end caps\",Passed,2025-05-30,2025-06-04,5,100,RMA10009,Yes,Yes,4\nWC10010,PRD10002,PB00002,CUST7890,DLR234,2025-06-10,2025-03-15,2025-06-05,Pending,Canister Denting,Manufacturing Defect,Pending,Damaged,14500,Hyundai,Sonata,2024,5NPE34AF6KH901234,0.5,45.00,8.99,53.99,\"Filter canister showed signs of pre-existing damage\",In Review,,,5,100,RMA10010,No,Pending,\nWC10011,PRD10003,PB00003,CUST8901,DLR567,2025-07-05,2025-03-20,2025-07-01,Approved,Anti-Drainback Valve Failure,Design Flaw,Replacement,Damaged,42000,Ram,1500,2023,1C6SRFFT4MN012345,0.75,67.50,19.99,87.49,\"Anti-drainback valve failed causing dry starts\",Passed,2025-07-10,2025-07-15,5,100,RMA10011,Yes,Yes,5\nWC10012,PRD10004,PB00004,CUST9012,DLR890,2025-05-15,2025-03-25,2025-05-10,Approved,End Cap Separation,Manufacturing Defect,Replacement,Damaged,9800,Volkswagen,GTI,2024,3VW5T7AU7KM123456,0.75,67.50,24.99,92.49,\"End cap separated from filter body\",Passed,2025-05-20,2025-05-25,5,100,RMA10012,Yes,Yes,4\nWC10013,PRD10001,PB00001,CUST0123,DLR123,2025-06-30,2025-04-01,2025-06-25,Pending,Pressure Relief Valve Failure,Material Defect,Pending,Damaged,22500,Audi,A4,2025,WAUENAF40KN234567,0.5,45.00,12.99,57.99,\"Pressure relief valve stuck closed\",In Review,,,5,100,RMA10013,No,Pending,\nWC10014,PRD10002,PB00002,CUST1234,DLR456,2025-07-20,2025-04-05,2025-07-15,Approved,Contamination,Manufacturing Defect,Replacement,Damaged,16800,BMW,330i,2024,WBA8B9G55HNU345678,0.5,45.00,8.99,53.99,\"Internal contamination found in new filter\",Passed,2025-07-25,2025-07-30,5,100,RMA10014,Yes,Yes,3\nWC10015,PRD10003,PB00003,CUST2345,DLR789,2025-08-10,2025-04-10,2025-08-05,Approved,Housing Crack,Material Defect,Replacement,Damaged,38500,Chevrolet,Silverado,2023,1GCUYDED5MZ456789,0.75,67.50,19.99,87.49,\"Filter housing cracked under normal pressure\",Passed,2025-08-15,2025-08-20,5,100,RMA10015,Yes,Yes,4\nWC10016,PRD10004,PB00004,CUST3456,DLR234,2025-06-05,2025-04-15,2025-06-01,Rejected,No Defect Found,No Issue,None,Intact,11200,Porsche,911,2024,WP0AB2A92LS567890,0,0.00,0.00,0.00,\"No evidence of product failure found\",Failed,2025-06-10,,5,0,RMA10016,Yes,No,1\nWC10017,PRD10001,PB00001,CUST4567,DLR567,2025-07-15,2025-04-20,2025-07-10,Approved,Gasket Extrusion,Manufacturing Defect,Replacement,Damaged,25700,Lexus,ES,2025,JTHBK1GG7F2678901,0.5,45.00,12.99,57.99,\"Filter gasket extruded from mounting surface\",Passed,2025-07-20,2025-07-25,5,100,RMA10017,Yes,Yes,5\nWC10018,PRD10002,PB00002,CUST5678,DLR890,2025-08-05,2025-04-25,2025-08-01,Pending,Media Collapse,Material Defect,Pending,Damaged,19300,Infiniti,Q50,2024,JN1EV7AP4KM789012,0.5,45.00,8.99,53.99,\"Filter media collapsed causing restricted flow\",In Review,,,5,100,RMA10018,No,Pending,\nWC10019,PRD10003,PB00003,CUST6789,DLR345,2025-09-20,2025-05-01,2025-09-15,Approved,Weld Failure,Manufacturing Defect,Replacement,Damaged,45000,Ford,F-250,2023,1FT7W2BT6NEA89012,0.75,67.50,19.99,87.49,\"Canister weld failed under normal pressure\",Passed,2025-09-25,2025-09-30,5,100,RMA10019,Yes,Yes,4\nWC10020,PRD10004,PB00004,CUST7890,DLR678,2025-06-25,2025-05-05,2025-06-20,Approved,Bypass Valve Spring Failure,Material Defect,Replacement,Damaged,13500,Subaru,BRZ,2024,JF1ZCAC19H9901234,0.75,67.50,24.99,92.49,\"Bypass valve spring broke causing continuous bypass\",Passed,2025-06-30,2025-07-05,5,100,RMA10020,Yes,Yes,5\r\n\r\n",
            "file_count": "12",
            "id": "b465273c-4fa4-4b2e-8441-65730a57a3ad",
            "file_name": "sample_data\/csv",
            "schema": "\n-- Customers Table\nCREATE TABLE customers (\n    customer_id VARCHAR(20) PRIMARY KEY,\n    customer_name VARCHAR(100) NOT NULL,\n    email VARCHAR(100) NOT NULL,\n    phone VARCHAR(20) NOT NULL,\n    address VARCHAR(200) NOT NULL,\n    city VARCHAR(50) NOT NULL,\n    state VARCHAR(50) NOT NULL,\n    zip VARCHAR(20) NOT NULL,\n    country VARCHAR(50) NOT NULL\n);\n\n-- Orders Table\nCREATE TABLE orders (\n    order_id VARCHAR(20) PRIMARY KEY,\n    customer_id VARCHAR(20) NOT NULL,\n    order_date DATE NOT NULL,\n    ship_date DATE NOT NULL,\n    ship_address VARCHAR(200) NOT NULL,\n    ship_city VARCHAR(50) NOT NULL,\n    ship_state VARCHAR(50) NOT NULL,\n    ship_zip VARCHAR(20) NOT NULL,\n    ship_country VARCHAR(50) NOT NULL,\n    total_amount DECIMAL(10,2) NOT NULL,\n    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)\n);\n\n-- Products Table\nCREATE TABLE products (\n    product_id VARCHAR(20) PRIMARY KEY,\n    product_name VARCHAR(100) NOT NULL,\n    description TEXT NOT NULL,\n    category VARCHAR(50) NOT NULL,\n    price DECIMAL(10,2) NOT NULL,\n    inventory_count INTEGER NOT NULL\n);\n\n-- Order_Items Table\nCREATE TABLE order_items (\n    order_item_id VARCHAR(20) PRIMARY KEY,\n    order_id VARCHAR(20) NOT NULL,\n    product_id VARCHAR(20) NOT NULL,\n    quantity INTEGER NOT NULL,\n    unit_price DECIMAL(10,2) NOT NULL,\n    FOREIGN KEY (order_id) REFERENCES orders(order_id),\n    FOREIGN KEY (product_id) REFERENCES products(product_id)\n);\n",
            "timestamp": "2025-05-05T23:40:42Z"
        }
    , 
    {
    // Mock data entry specifically for testing CSV parsing with quoted fields
    id: "87086dce-010b-4896-ade6-baeff281a384",
    timestamp: "2025-06-12T13:49:24Z",
    file_name: "analyze/batch4097st",
    file_count: "1",
    schema: "-- Albums Table - Main table containing album information\nCREATE TABLE albums (\n    album_id SERIAL PRIMARY KEY,\n    ranking INTEGER NOT NULL,\n    album_name VARCHAR(255) NOT NULL,\n    artist_name VARCHAR(255) NOT NULL,\n    release_date DATE NOT NULL,\n    average_rating DECIMAL(3,2) NOT NULL,\n    number_of_ratings INTEGER NOT NULL,\n    number_of_reviews INTEGER NOT NULL\n);\n\n-- Genres Table - Master list of genres\nCREATE TABLE genres (\n    genre_id SERIAL PRIMARY KEY,\n    genre_name VARCHAR(100) NOT NULL UNIQUE\n);\n\n-- Album_Genres Table - Junction table for albums and genres (many-to-many)\nCREATE TABLE album_genres (\n    album_id INTEGER NOT NULL,\n    genre_id INTEGER NOT NULL,\n    PRIMARY KEY (album_id, genre_id),\n    FOREIGN KEY (album_id) REFERENCES albums(album_id),\n    FOREIGN KEY (genre_id) REFERENCES genres(genre_id)\n);\n\n-- Descriptors Table - Master list of descriptors\nCREATE TABLE descriptors (\n    descriptor_id SERIAL PRIMARY KEY,\n    descriptor_name VARCHAR(100) NOT NULL UNIQUE\n);\n\n-- Album_Descriptors Table - Junction table for albums and descriptors (many-to-many)\nCREATE TABLE album_descriptors (\n    album_id INTEGER NOT NULL,\n    descriptor_id INTEGER NOT NULL,\n    PRIMARY KEY (album_id, descriptor_id),\n    FOREIGN KEY (album_id) REFERENCES albums(album_id),\n    FOREIGN KEY (descriptor_id) REFERENCES descriptors(descriptor_id)\n);",
    results: "File: analyze/batch4097st/rym_top_5000_all_time_fixed.csv\r\nRanking,Album,Artist Name,Release Date,Genres,Descriptors,Average Rating,Number of Ratings,Number of Reviews\r\r\n1.,OK Computer,Radiohead,16 June 1997,\"Alternative Rock, Art Rock\",\"melancholic, anxious, futuristic, alienation, existential, male vocals, atmospheric, lonely, cold, introspective\",4.23,70382,1531\r\r\n2.,Wish You Were Here,Pink Floyd,12 September 1975,\"Progressive Rock, Art Rock\",\"melancholic, atmospheric, progressive, male vocals, concept album, introspective, serious, longing, bittersweet, meditative\",4.29,48662,983\r\r\n3.,In the Court of the Crimson King,King Crimson,10 October 1969,\"Progressive Rock, Art Rock\",\"fantasy, epic, progressive, philosophical, complex, surreal, poetic, male vocals, melancholic, technical\",4.30,44943,870\r\r\n4.,Kid A,Radiohead,3 October 2000,\"Art Rock, Experimental Rock, Electronic\",\"cold, melancholic, futuristic, atmospheric, anxious, cryptic, sombre, abstract, introspective, male vocals\",4.21,58590,734\r\r\n5.,To Pimp a Butterfly,Kendrick Lamar,15 March 2015,\"Conscious Hip Hop, West Coast Hip Hop, Jazz Rap\",\"political, conscious, poetic, protest, concept album, introspective, urban, male vocals, eclectic, passionate\",4.27,44206,379\r\r\n6.,Loveless,My Bloody Valentine,4 November 1991,\"Shoegaze, Noise Pop\",\"noisy, ethereal, atmospheric, romantic, dense, hypnotic, love, psychedelic, lush, bittersweet\",4.24,49887,1223\r\r\n7.,The Dark Side of the Moon,Pink Floyd,23 March 1973,\"Art Rock, Progressive Rock\",\"philosophical, atmospheric, introspective, existential, mellow, concept album, male vocals, psychedelic, progressive, epic\",4.20,57622,1549\r\r\n8.,Abbey Road,The Beatles,26 September 1969,Pop Rock,\"melodic, warm, male vocals, bittersweet, summer, uplifting, love, romantic, medley, happy\",4.25,44544,961\r\r\n9.,The Velvet Underground & Nico,The Velvet Underground & Nico,12 March 1967,\"Art Rock, Experimental Rock\",\"drugs, sexual, raw, urban, noisy, nihilistic, avant-garde, male vocals, eclectic, female vocals\",4.23,45570,929\r\r\n\r\n"
}
]

const SCHEMA_TRANSLATOR_DATA = [{
    id: "8513b034-b2a1-4dc2-a468-c4c524d32b1b",
    timestamp: "2025-04-11T15:12:35Z",
    input: "-- Core Product Tables\nCREATE TABLE Products (product_id VARCHAR(10) PRIMARY KEY, name VARCHAR(100), sku VARCHAR(20) UNIQUE, price DECIMAL(10,2));\nCREATE TABLE Parts (part_id VARCHAR(10) PRIMARY KEY, name VARCHAR(100), part_number VARCHAR(20));\n\n-- BOM Structure\nCREATE TABLE EngineeringBOM (ebom_id VARCHAR(10) PRIMARY KEY, product_sku VARCHAR(20), part_id VARCHAR(10), unit_quantity INT, FOREIGN KEY (product_sku) REFERENCES Products(sku), FOREIGN KEY (part_id) REFERENCES Parts(part_id));\nCREATE TABLE ManufacturingBOM (cbom_id VARCHAR(10) PRIMARY KEY, ebom_id VARCHAR(10), part_id VARCHAR(10), unit_quantity INT, description VARCHAR(200), manufacturer VARCHAR(100), supplier_id VARCHAR(10), country_origin VARCHAR(50), cost DECIMAL(10,2), weight INT, leadtime_days INT, FOREIGN KEY (ebom_id) REFERENCES EngineeringBOM(ebom_id), FOREIGN KEY (part_id) REFERENCES Parts(part_id));\n\n-- Supplier Management\nCREATE TABLE Suppliers (supplier_id VARCHAR(10) PRIMARY KEY, name VARCHAR(100), country VARCHAR(50));\nCREATE TABLE SupplierKPIs (kpi_id VARCHAR(10) PRIMARY KEY, supplier_id VARCHAR(10), on_time_delivery DECIMAL(4,2), quality_score DECIMAL(4,2), cost_performance DECIMAL(4,2), FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id));\n\n-- Manufacturing Setup\nCREATE TABLE Facilities (facility_id VARCHAR(10) PRIMARY KEY, name VARCHAR(100), location VARCHAR(100));\nCREATE TABLE WorkCenters (workcenter_id VARCHAR(10) PRIMARY KEY, facility_id VARCHAR(10), name VARCHAR(100), FOREIGN KEY (facility_id) REFERENCES Facilities(facility_id));\nCREATE TABLE Machines (machine_id VARCHAR(10) PRIMARY KEY, workcenter_id VARCHAR(10), name VARCHAR(100), type VARCHAR(50), FOREIGN KEY (workcenter_id) REFERENCES WorkCenters(workcenter_id));\n\n-- Production Management\nCREATE TABLE ProductionOrders (order_id VARCHAR(10) PRIMARY KEY, order_number VARCHAR(20), quantity INT, due_date DATE, workcenter_id VARCHAR(10), FOREIGN KEY (workcenter_id) REFERENCES WorkCenters(workcenter_id));\nCREATE TABLE ProductionBatches (batch_id VARCHAR(10) PRIMARY KEY, production_order_id VARCHAR(10), name VARCHAR(100), sku VARCHAR(20), num_of_units INT, start_time TIMESTAMP, end_time TIMESTAMP, FOREIGN KEY (production_order_id) REFERENCES ProductionOrders(order_id));\n\n-- Quality Management\nCREATE TABLE WarrantyClaims (claim_id VARCHAR(10) PRIMARY KEY, claim_number VARCHAR(20), status VARCHAR(20), filing_date DATE, sku VARCHAR(20), city VARCHAR(50), zip VARCHAR(10), customer_notes TEXT, failure_cause VARCHAR(100), FOREIGN KEY (sku) REFERENCES Products(sku));\nCREATE TABLE QualityInspections (inspection_id VARCHAR(10) PRIMARY KEY, batch_id VARCHAR(10), name VARCHAR(100), failure_type VARCHAR(50), num_of_failures INT, FOREIGN KEY (batch_id) REFERENCES ProductionBatches(batch_id));\n\n-- Sales Management\nCREATE TABLE Customers (customer_id VARCHAR(10) PRIMARY KEY, name VARCHAR(100), location VARCHAR(100));\nCREATE TABLE SalesOrders (order_id VARCHAR(10) PRIMARY KEY, order_number VARCHAR(20), order_date DATE, total_amount DECIMAL(10,2), customer_id VARCHAR(10), sku VARCHAR(20), FOREIGN KEY (customer_id) REFERENCES Customers(customer_id), FOREIGN KEY (sku) REFERENCES Products(sku));",
    results: "[Product] —(CONTAINS)→ [Part]\n[EngineeringBOM] —(REFERENCES)→ [Product]\n[EngineeringBOM] —(REFERENCES)→ [Part]\n[ManufacturingBOM] —(REFERENCES)→ [EngineeringBOM]\n[ManufacturingBOM] —(REFERENCES)→ [Part]\n[ManufacturingBOM] —(SUPPLIED_BY)→ [Supplier]\n[SupplierKPIs] —(EVALUATES)→ [Supplier]\n[ProductionOrders] —(SCHEDULED_AT)→ [WorkCenter]\n[ProductionBatches] —(PART_OF)→ [ProductionOrders]\n[QualityInspections] —(INSPECTS)→ [ProductionBatches]\n[WarrantyClaims] —(RELATED_TO)→ [Product]\n[SalesOrders] —(PLACED_BY)→ [Customer]\n[SalesOrders] —(CONTAINS)→ [Product]"
}]

    // 2. Describe network behavior with request handlers.
const dcAPI = amplify.API.REST['data-classifier'].endpoint;
const blAPI = amplify.API.REST['data-loader'].endpoint;
const daAPI = amplify.API.REST['data-analyzer'].endpoint;
const stAPI = amplify.API.REST['schema-translator'].endpoint;

let CHAT_HISTORY:Record<string,any>={}

export const handlers = [
  http.get(dcAPI, ({ request, params, cookies }) => {
    return HttpResponse.json({  "items" : dataClassifier   } )
  }),
  http.get(`${dcAPI}:id`, ({ request, params, cookies }) => {
    const { id } = params;
    return HttpResponse.json({  "items" : [ dataClassifier.find(d=>d.id==id) ]  } )
  }),
  http.get(blAPI, ({ request, params, cookies }) => {
    return HttpResponse.json({  "items" : BULK_LOAD_DATA   } )
  }),
  http.get(`${blAPI}:id`, ({ request, params, cookies }) => {
    const { id } = params;
    return HttpResponse.json({  "items" : [ BULK_LOAD_DATA.find(d=>d.loadId==id) ]  } )
  }),
  http.get(daAPI, ({ request, params, cookies }) => {
    return HttpResponse.json({  "items" : DATA_ANALYZER_DATA   } )
  }),
  http.get("*/chat-history/:id", ({ params }) => {
    const { id } = params;
    return HttpResponse.json({ "items" : CHAT_HISTORY.id! || [] })
  }),
  http.post("*/chat-history/:id", ({ request, params }) => {
    const { id } = params;
    CHAT_HISTORY.id! = request.json()
  }),
  http.get(`${daAPI}:id`, ({ request, params, cookies }) => {
    const { id } = params;
    return HttpResponse.json({ "items": [ DATA_ANALYZER_DATA.find(d => d.id === id) ] })
  }),
  http.get(stAPI, ({ request, params, cookies }) => {
    return HttpResponse.json({ "items" : SCHEMA_TRANSLATOR_DATA } )
  }),
  http.get(`${stAPI}:id`, ({ request, params, cookies }) => {
    const { id } = params;
    return HttpResponse.json({ "items" : [ SCHEMA_TRANSLATOR_DATA.find(d=>d.id==id) ]  } )
  }),
  http.post('*/chat/query', async () => {
    await delay(100);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const responses = [
          { type: 'metadata', data: { metadata: { agentName: 'TestBot' } } },
          { type: 'chunk', data: 'This is a test response. You likely have mocks enabled for testing.' },
          { type: 'complete', data: '' }
        ];

        for (const response of responses) {
          const chunk = encoder.encode(JSON.stringify(response) + '\n');
          controller.enqueue(chunk);
          await delay(50);
        }
        controller.close();
      }
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });
  }),
]
