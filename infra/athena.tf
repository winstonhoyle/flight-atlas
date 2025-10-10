############################################################
# Glue catalog database (Athena database)
############################################################
resource "aws_glue_catalog_database" "flights_db" {
  name = var.athena_database_name
}

############################################################
# Glue catalog table (Athena table) - Routes
############################################################
resource "aws_glue_catalog_table" "flights_table" {
  name          = var.athena_routes_table_name
  database_name = aws_glue_catalog_database.flights_db.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "classification" = "parquet"
    "typeOfData"     = "file"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.flights_bucket.bucket}/flights/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"
    compressed    = false

    # Columns
    columns {
      name = "dst_airport"
      type = "string"
    }

    columns {
      name = "dst_geometry"
      type = "string"
    }

    columns {
      name = "src_geometry"
      type = "string"
    }

    ser_de_info {
      name                  = "parquet"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }
  }

  # Partition keys (top-level blocks)
  partition_keys {
    name = "year"
    type = "string"
  }

  partition_keys {
    name = "month"
    type = "string"
  }
  partition_keys {
    name = "airline_code"
    type = "string"
  }

  partition_keys {
    name = "src_airport"
    type = "string"
  }
}

############################################################
# Glue catalog table (Athena table) - Airports
############################################################
resource "aws_glue_catalog_table" "airports_table" {
  name          = var.athena_airports_table_name
  database_name = aws_glue_catalog_database.flights_db.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "classification" = "parquet"
    "typeOfData"     = "file"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.flights_bucket.bucket}/airports/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"
    compressed    = false

    # Columns
    columns {
      name = "faa"
      type = "string"
    }

    columns {
      name = "iata"
      type = "string"
    }

    columns {
      name = "url"
      type = "string"
    }

    columns {
      name = "geometry"
      type = "string"
    }

    columns {
      name = "title"
      type = "string"
    }

    ser_de_info {
      name                  = "parquet"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }
  }

  # Partition key for snapshot
  partition_keys {
    name = "year"
    type = "string"
  }

  partition_keys {
    name = "month"
    type = "string"
  }
}


############################################################
# Glue catalog table (Athena table) - Airlines
############################################################
resource "aws_glue_catalog_table" "airlines" {
  name          = var.athena_airlines_table_name
  database_name = aws_glue_catalog_database.flights_db.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "classification" = "parquet"
    "typeOfData"     = "file"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.flights_bucket.bucket}/airports/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"
    compressed    = false

    # Columns
      columns {
      name = "name"
      type = "string"
    }

    columns {
      name = "airline_code"
      type = "string"
    }
    ser_de_info {
      name                  = "parquet"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }
  }

  # Partition key for snapshot
  partition_keys {
    name = "year"
    type = "string"
  }

  partition_keys {
    name = "month"
    type = "string"
  }
}