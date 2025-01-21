
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import os

app = Flask(__name__)
CORS(app)

@app.route('/upload', methods=['POST'])
def upload_video():
    try:
        video_file = request.files['video']
        video_path = os.path.join('uploaded_videos', video_file.filename)
        video_file.save(video_path)

        video = cv2.VideoCapture(video_path)
        frame_rate = video.get(cv2.CAP_PROP_FPS)
        total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))

        # Calculate the middle frame number
        mid_frame_number = total_frames // 2
        # Set the frame position to the middle frame
        video.set(cv2.CAP_PROP_POS_FRAMES, mid_frame_number)
        ret, mid_frame = video.read()

        # Function to crop a region of interest (ROI)
        def crop_frame(frame, roi):
            x, y, w, h = roi
            return frame[y:y+h, x:x+w]

        # Function to select a point for intensity analysis
        def select_point(frame):
            cv2.imshow('Select a point for intensity analysis', frame)
            point = cv2.selectROI('Select a point for intensity analysis', frame, fromCenter=False, showCrosshair=True)
            cv2.destroyAllWindows()
            return int(point[0]), int(point[1])

        # Read the first frame for user ROI selection
        video.set(cv2.CAP_PROP_POS_FRAMES, 0)
        ret, first_frame = video.read()

        # User selects ROI
        roi = cv2.selectROI("Select a region to zoom in", first_frame, fromCenter=False, showCrosshair=True)
        cv2.destroyAllWindows()

        # Crop the image based on selected ROI
        cropped_frame = crop_frame(first_frame, roi)

        # User selects a point in the cropped frame
        selected_x, selected_y = select_point(cropped_frame)

        # Arrays to store intensity values and timestamps
        intensity_values = np.zeros(total_frames)
        time_stamps = np.zeros(total_frames)

        # Reset video to the first frame
        video.set(cv2.CAP_PROP_POS_FRAMES, 0)
        frame_count = 0

        # Loop through each frame to extract intensity at the selected point
        while video.isOpened():
            ret, frame = video.read()
            if not ret:
                break

            cropped_frame = crop_frame(frame, roi)
            gray_frame = cv2.cvtColor(cropped_frame, cv2.COLOR_BGR2GRAY)

            # Ensure the selected point is within the cropped frame boundaries
            if 0 <= selected_x < gray_frame.shape[1] and 0 <= selected_y < gray_frame.shape[0]:
                intensity_values[frame_count] = gray_frame[selected_y, selected_x]
                time_stamps[frame_count] = video.get(cv2.CAP_PROP_POS_MSEC) / 1000  # Convert milliseconds to seconds

            frame_count += 1

        # Trim unused elements
        intensity_values = intensity_values[:frame_count]
        time_stamps = time_stamps[:frame_count]

        # Release the video
        video.release()

        return jsonify({
            'message': 'Video processed successfully!',
            'intensity_values': intensity_values.tolist(),
            'time_stamps': time_stamps.tolist()
        })

    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}'})

if __name__ == '__main__':
    if not os.path.exists('uploaded_videos'):
        os.makedirs('uploaded_videos')
    app.run(debug=True)

