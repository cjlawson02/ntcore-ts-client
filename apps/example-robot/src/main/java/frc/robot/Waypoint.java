// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot;

import org.wpilib.util.struct.Struct;
import java.nio.ByteBuffer;

/**
 * Custom (non-WPILib-built-in) struct type used by the E2E suite to exercise the client's schema
 * auto-fetch path. Because {@code Waypoint} is not in the ntcore-ts {@code built-in-schemas.ts}
 * list, the client must decode it by fetching {@code /.schema/struct:Waypoint} from the server at
 * runtime.
 */
public record Waypoint(double x, double y, double heading, int id) {
  /** Struct serializer for {@link Waypoint}. */
  public static final WaypointStruct struct = new WaypointStruct();

  /** Fixed-size struct serializer. */
  public static final class WaypointStruct implements Struct<Waypoint> {
    @Override
    public Class<Waypoint> getTypeClass() {
      return Waypoint.class;
    }

    @Override
    public String getTypeName() {
      return "Waypoint";
    }

    @Override
    public int getSize() {
      return DOUBLE_SIZE * 3 + INT32_SIZE;
    }

    @Override
    public String getSchema() {
      return "double x;double y;double heading;int32 id";
    }

    @Override
    public Waypoint unpack(ByteBuffer bb) {
      double x = bb.getDouble();
      double y = bb.getDouble();
      double heading = bb.getDouble();
      int id = bb.getInt();
      return new Waypoint(x, y, heading, id);
    }

    @Override
    public void pack(ByteBuffer bb, Waypoint value) {
      bb.putDouble(value.x);
      bb.putDouble(value.y);
      bb.putDouble(value.heading);
      bb.putInt(value.id);
    }

    @Override
    public boolean isImmutable() {
      return true;
    }
  }
}
