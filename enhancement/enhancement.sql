CREATE OR REPLACE STREAM "enhanced_stream" (INGESTION_TIME BIGINT, AD VARCHAR(12));

CREATE OR REPLACE PUMP "enhanced_stream_pump" AS INSERT INTO "enhanced_stream"
      SELECT STREAM UNIX_TIMESTAMP(APPROXIMATE_ARRIVAL_TIME), "r"."REFERENCE" as "AD"
      FROM "input_stream_001" LEFT JOIN "referential" as "r"
      ON "input_stream_001"."AD" = "r"."CODE";

CREATE OR REPLACE STREAM "count_stream" (AD VARCHAR(12), INGESTION_TIME BIGINT, NBR INTEGER);

CREATE OR REPLACE PUMP "count_stream_pump" AS INSERT INTO "count_stream"
    SELECT STREAM AD, MIN(INGESTION_TIME), COUNT(AD)
        FROM "enhanced_stream"
        GROUP BY AD,
            STEP("enhanced_stream".ROWTIME BY INTERVAL '30' SECOND);