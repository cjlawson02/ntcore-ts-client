// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot;

import org.wpilib.framework.TimedRobot;
import org.wpilib.math.geometry.Pose2d;
import org.wpilib.math.geometry.Rotation2d;
import org.wpilib.networktables.*;
import org.wpilib.smartdashboard.SendableChooser;
import org.wpilib.smartdashboard.SmartDashboard;

/**
 * The methods in this class are called automatically corresponding to each mode, as described in
 * the TimedRobot documentation. If you change the name of this class or the package after creating
 * this project, you must also update the Main.java file in the project.
 */
public class Robot extends TimedRobot {
  private static final String kDefaultAuto = "Default";
  private static final String kCustomAuto = "My Auto";
  private String autoSelected;
  private final SendableChooser<String> chooser = new SendableChooser<>();
  private static final NetworkTableInstance nt = NetworkTableInstance.getDefault();

  private DoublePublisher xPub;
  private DoublePublisher yPub;
  private DoublePublisher gyroPub;
  /** Retained so `/MyTable/AutoMode` stays advertised for example-react / e2e. */
  private StringSubscriber autoSub;
  private ProtobufPublisher<Pose2d> posePub;
  private StructPublisher<Pose2d> poseStructPub;
  /** Subscribes to client-published struct, echoes to PoseStructEcho for E2E verification. */
  private StructSubscriber<Pose2d> poseStructFromClientSub;
  private StructPublisher<Pose2d> poseStructEchoPub;

  // --- Scalar primitives (E2E: topic-subscription.md SUB-5..SUB-7) ---
  private BooleanPublisher scalarBoolPub;
  private IntegerPublisher scalarIntPub;
  private FloatPublisher scalarFloatPub;

  // --- Scalar arrays (E2E: topic-subscription.md SUB-8..SUB-12) ---
  private BooleanArrayPublisher scalarBoolArrayPub;
  private DoubleArrayPublisher scalarDoubleArrayPub;
  private IntegerArrayPublisher scalarIntArrayPub;
  private FloatArrayPublisher scalarFloatArrayPub;
  private StringArrayPublisher scalarStringArrayPub;

  /** Custom (non-built-in) struct publisher used by the struct-schema-fetch E2E spec. */
  private StructPublisher<Waypoint> waypointPub;

  private double demoTime = 0;
  private static final double kDemoFigure8ScaleX = 1.8;
  private static final double kDemoFigure8ScaleY = 1.2;
  /** Y offset so path sits higher on pose grid (+Y = up on grid). */
  private static final double kDemoPoseOffsetY = 1.5;
  private static final double kDemoFigure8PeriodSec = 10.0;

  /**
   * This function is run when the robot is first started up and should be used for any
   * initialization code.
   */
  public Robot() {
    chooser.setDefaultOption("Default Auto", kDefaultAuto);
    chooser.addOption("My Auto", kCustomAuto);
    SmartDashboard.putData("Auto choices", chooser);

    // AutoMode string topic (example-react / e2e)
    autoSub = nt.getStringTopic("/MyTable/AutoMode").subscribe(kDefaultAuto);

    // Accelerometer values
    xPub = nt.getDoubleTopic("/MyTable/Accelerometer/X").publish();
    yPub = nt.getDoubleTopic("/MyTable/Accelerometer/Y").publish();

    posePub = nt.getProtobufTopic("/MyTable/Pose", Pose2d.proto).publish();
    posePub.set(new Pose2d(0, 0, new Rotation2d(0)));

    poseStructPub = nt.getStructTopic("/MyTable/PoseStruct", Pose2d.struct).publish();
    poseStructPub.set(new Pose2d(0, 0, new Rotation2d(0)));

    // Subscribe to client-published struct topic and echo to PoseStructEcho for E2E verification
    poseStructFromClientSub =
        nt.getStructTopic("/MyTable/PoseStructFromClient", Pose2d.struct)
            .subscribe(new Pose2d(0, 0, new Rotation2d(0)));
    poseStructEchoPub = nt.getStructTopic("/MyTable/PoseStructEcho", Pose2d.struct).publish();

    gyroPub = nt.getDoubleTopic("/MyTable/Gyro").publish();

    // Scalar primitives — each exercised by one E2E test (topic-subscription.md SUB-5..SUB-12)
    // to prove the wire/msgpack path for its NT type number works end-to-end (unit tests only
    // cover zod validation of the value).
    scalarBoolPub = nt.getBooleanTopic("/MyTable/Scalars/Bool").publish();
    scalarBoolPub.set(true);
    scalarIntPub = nt.getIntegerTopic("/MyTable/Scalars/Int").publish();
    scalarIntPub.set(42L);
    scalarFloatPub = nt.getFloatTopic("/MyTable/Scalars/Float").publish();
    scalarFloatPub.set(1.5f);

    // Scalar arrays
    scalarBoolArrayPub = nt.getBooleanArrayTopic("/MyTable/Scalars/BoolArray").publish();
    scalarBoolArrayPub.set(new boolean[] {true, false, true});
    scalarDoubleArrayPub = nt.getDoubleArrayTopic("/MyTable/Scalars/DoubleArray").publish();
    scalarDoubleArrayPub.set(new double[] {1.1, 2.2, 3.3});
    scalarIntArrayPub = nt.getIntegerArrayTopic("/MyTable/Scalars/IntArray").publish();
    scalarIntArrayPub.set(new long[] {10L, 20L, 30L});
    scalarFloatArrayPub = nt.getFloatArrayTopic("/MyTable/Scalars/FloatArray").publish();
    scalarFloatArrayPub.set(new float[] {0.5f, 1.5f, 2.5f});
    scalarStringArrayPub = nt.getStringArrayTopic("/MyTable/Scalars/StringArray").publish();
    scalarStringArrayPub.set(new String[] {"alpha", "beta", "gamma"});

    // Custom struct type (not in the ntcore-ts built-in schema table) — forces the client to
    // fetch the schema from /.schema/struct:Waypoint at runtime (E2E: custom-struct-schema.md).
    waypointPub = nt.getStructTopic("/MyTable/Waypoint", Waypoint.struct).publish();
    waypointPub.set(new Waypoint(1.25, -2.5, Math.PI / 3, 7));
  }

  /**
   * This function is called every 20 ms, no matter the mode. Use this for items like diagnostics
   * that you want ran during disabled, autonomous, teleoperated and utility.
   *
   * <p>This runs after the mode specific periodic functions, but before LiveWindow and
   * SmartDashboard integrated updating.
   */
  @Override
  public void robotPeriodic() {
    // Echo client-published struct values to PoseStructEcho for E2E verification
    for (Pose2d received : poseStructFromClientSub.readQueueValues()) {
      poseStructEchoPub.set(received);
    }
  }

  /**
   * This autonomous (along with the chooser code above) shows how to select between different
   * autonomous modes using the dashboard. The sendable chooser code works with the Java
   * SmartDashboard. If you prefer the LabVIEW Dashboard, remove all of the chooser code and
   * uncomment the getString line to get the auto name from the text box below the Gyro
   *
   * <p>You can add additional auto modes by adding additional comparisons to the switch structure
   * below with additional strings. If using the SendableChooser make sure to add them to the
   * chooser code above as well.
   */
  @Override
  public void autonomousInit() {
    autoSelected = chooser.getSelected();
    // autoSelected = SmartDashboard.getString("Auto Selector", kDefaultAuto);
    System.out.println("Auto selected: " + autoSelected);
  }

  /** This function is called periodically during autonomous. */
  @Override
  public void autonomousPeriodic() {
    switch (autoSelected) {
      case kCustomAuto:
        // Put custom auto code here
        break;
      case kDefaultAuto:
      default:
        // Put default auto code here
        break;
    }
  }

  /** This function is called once when teleop is enabled. */
  @Override
  public void teleopInit() {}

  /** This function is called periodically during operator control. */
  @Override
  public void teleopPeriodic() {}

  /** This function is called once when the robot is disabled. */
  @Override
  public void disabledInit() {
    gyroPub.set(0);
    xPub.set(0);
    yPub.set(0);
    posePub.set(new Pose2d(0, 0, new Rotation2d(0)));
    poseStructPub.set(new Pose2d(0, 0, new Rotation2d(0)));
  }

  /** This function is called periodically when disabled. */
  @Override
  public void disabledPeriodic() {}

  /** This function is called once when utility mode is enabled. */
  @Override
  public void utilityInit() {
    demoTime = 0;
  }

  /** This function is called periodically during utility mode. */
  @Override
  public void utilityPeriodic() {
    demoTime += getPeriod();
    double t = demoTime;
    double omega = 2 * Math.PI / kDemoFigure8PeriodSec;

    // Pose: figure-8 (Lissajous) with Y offset so path sits higher on pose grid
    double x = kDemoFigure8ScaleX * Math.sin(omega * t);
    double y = kDemoPoseOffsetY + kDemoFigure8ScaleY * Math.sin(2 * omega * t);
    double vx = kDemoFigure8ScaleX * omega * Math.cos(omega * t);
    double vy = kDemoFigure8ScaleY * 2 * omega * Math.cos(2 * omega * t);
    double axWorld = -kDemoFigure8ScaleX * omega * omega * Math.sin(omega * t);
    double ayWorld = -kDemoFigure8ScaleY * 4 * omega * omega * Math.sin(2 * omega * t);

    double thetaRad = Math.atan2(vy, vx);
    Pose2d pose = new Pose2d(x, y, new Rotation2d(thetaRad));
    posePub.set(pose);
    poseStructPub.set(pose);

    // Gyro: match heading in degrees (CCW positive)
    gyroPub.set(Math.toDegrees(thetaRad));

    // Accelerometer values (X, Y in robot frame)
    double cosT = Math.cos(thetaRad);
    double sinT = Math.sin(thetaRad);
    double axRobot = (axWorld * cosT + ayWorld * sinT) / 9.81;
    double ayRobot = (-axWorld * sinT + ayWorld * cosT) / 9.81;
    xPub.set(axRobot);
    yPub.set(ayRobot);
  }

  /** This function is called once when the robot is first started up. */
  @Override
  public void simulationInit() {}

  /** This function is called periodically whilst in simulation. */
  @Override
  public void simulationPeriodic() {}
}
