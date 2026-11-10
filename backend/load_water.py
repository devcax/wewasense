import sqlite3
import pandas as pd

database_path = "wewasense.db"
water_csv_path = "model_files/water_clean.csv"
normals_csv_path = "model_files/tank_normals_train.csv"
needed_columns = {"tank_id", "date", "fill_percent", "normal_percent", "source"}


def get_table_columns(connection, table_name):
    rows = connection.execute(f"pragma table_info({table_name})").fetchall()
    return {row[1] for row in rows}


def load_readings_with_normals():
    water = pd.read_csv(water_csv_path)
    normals = pd.read_csv(normals_csv_path)
    water["month"] = pd.to_datetime(water["date"]).dt.month
    water = water.merge(normals, on=["tank_id", "month"], how="left")
    fallback_normal = water.groupby(["tank_id", "month"])["fill_smooth"].transform("median")
    water["normal_fill"] = water["normal_fill"].fillna(fallback_normal).fillna(0)
    water["fill_smooth"] = water["fill_smooth"].fillna(0)
    return pd.DataFrame(
        {
            "tank_id": water["tank_id"],
            "date": water["date"],
            "fill_percent": water["fill_smooth"].round(1),
            "normal_percent": water["normal_fill"].round(1),
            "source": "sentinel1",
        }
    )


def check_no_empty_values(readings):
    empty_counts = readings.isna().sum()
    if empty_counts.sum() > 0:
        print("Empty values found:", empty_counts[empty_counts > 0].to_dict())
        return False
    return True


def replace_readings(connection, readings):
    connection.execute("delete from water_readings")
    readings.to_sql("water_readings", connection, if_exists="append", index=False)
    connection.commit()


def main():
    connection = sqlite3.connect(database_path)
    columns = get_table_columns(connection, "water_readings")
    if not needed_columns.issubset(columns):
        print("Column names differ. The table has:", sorted(columns))
        return
    readings = load_readings_with_normals()
    if not check_no_empty_values(readings):
        return
    replace_readings(connection, readings)
    count = connection.execute("select count(*) from water_readings").fetchone()[0]
    latest = connection.execute("select max(date) from water_readings").fetchone()[0]
    print("Water readings loaded:", count)
    print("Latest reading date:", latest)


main()