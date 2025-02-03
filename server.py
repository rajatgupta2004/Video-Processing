from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import os
import ast

app = Flask(__name__)
CORS(app)

@app.route('/upload', methods=['POST'])
def process_video():
    try:
        video_file = request.files['video']

        # Save the video file to a temporary location
        video_path = os.path.join('uploaded_videos', video_file.filename)
        video_file.save(video_path)

        # Read the video file from the temporary location
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

        # Read the first frame for user ROI selection
        video.set(cv2.CAP_PROP_POS_FRAMES, 0)
        ret, first_frame = video.read()

        # Parse ROI from the request
        string = request.form.get('roi')
        roi = ast.literal_eval(string)

        # Crop the image based on selected ROI
        cropped_frame = crop_frame(first_frame, roi)

        # Parse selected point from the request
        selected_x = int(request.form.get('spx')) - roi[0]
        selected_y = int(request.form.get('spy')) - roi[1]

        # Ensure the selected point is within the bounds of the cropped frame
        if not (0 <= selected_x < cropped_frame.shape[1] and 0 <= selected_y < cropped_frame.shape[0]):
            return jsonify({'message': 'Error: Selected point is outside the bounds of the cropped frame'})

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

            # Convert frame to grayscale if it's a color image
            if len(cropped_frame.shape) == 3:
                gray_frame = cv2.cvtColor(cropped_frame, cv2.COLOR_BGR2GRAY)
            else:
                gray_frame = cropped_frame

            # Ensure the selected point is within the cropped frame boundaries
            if 0 <= selected_x < gray_frame.shape[1] and 0 <= selected_y < gray_frame.shape[0]:
                intensity_values[frame_count] = gray_frame[selected_y, selected_x]
                time_stamps[frame_count] = video.get(cv2.CAP_PROP_POS_MSEC) / 1000  # Convert milliseconds to seconds

            frame_count += 1

        # Trim unused elements
        intensity_values = intensity_values[:frame_count]
        time_stamps = time_stamps[:frame_count]

        # Release the video and delete the temporary file
        video.release()
        os.remove(video_path)

        return jsonify({
            'message': 'Video processed successfully!',
            'frame_rate': frame_rate,
            'total_frames': total_frames,
            'intensity_values': intensity_values.tolist(),
            'time_stamps': time_stamps.tolist()
        })

    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}'})

if __name__ == '__main__':
    if not os.path.exists('uploaded_videos'):
        os.makedirs('uploaded_videos')
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
